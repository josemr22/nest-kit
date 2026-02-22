import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ServiceBusClient, ServiceBusMessage, ServiceBusSender } from '@azure/service-bus';
import { SERVICE_BUS_CLIENT } from '../service-bus.constants';

/** Optional metadata to attach to a Service Bus message. */
export interface ServiceBusMessageOptions {
  /** Unique identifier for idempotent message processing. */
  messageId?: string;
  /** Correlation ID for tracing a message across multiple services. */
  correlationId?: string;
  /** MIME type of the message body (e.g. `'application/json'`). */
  contentType?: string;
  /** Application-specific label for routing or filtering. */
  subject?: string;
  /** Custom key-value properties accessible to consumers without deserializing the body. */
  applicationProperties?: Record<string, string | number | boolean>;
}

@Injectable()
export class ServiceBusService implements OnModuleDestroy {
  private readonly senders = new Map<string, ServiceBusSender>();

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
  ) {}

  /**
   * Sends a single message to a queue or topic.
   * @param queueOrTopic - Name of the target queue or topic.
   * @param body - Message payload (will be serialized by the SDK).
   * @param options - Optional message metadata.
   */
  async send(
    queueOrTopic: string,
    body: unknown,
    options?: ServiceBusMessageOptions,
  ): Promise<void> {
    const sender = this.getSender(queueOrTopic);
    await sender.sendMessages(this.buildMessage(body, options));
  }

  /**
   * Sends multiple messages to a queue or topic using efficient batch transport.
   * Automatically splits into multiple batches if the payload exceeds Azure's size limit (~256 KB).
   * @param queueOrTopic - Name of the target queue or topic.
   * @param bodies - Array of message payloads.
   * @param options - Optional metadata applied to all messages in the batch.
   */
  async sendBatch(
    queueOrTopic: string,
    bodies: unknown[],
    options?: ServiceBusMessageOptions,
  ): Promise<void> {
    const sender = this.getSender(queueOrTopic);
    let batch = await sender.createMessageBatch();

    for (const body of bodies) {
      const message = this.buildMessage(body, options);

      if (!batch.tryAddMessage(message)) {
        await sender.sendMessages(batch);
        batch = await sender.createMessageBatch();
        batch.tryAddMessage(message);
      }
    }

    if (batch.count > 0) {
      await sender.sendMessages(batch);
    }
  }

  /**
   * Schedules a message to be enqueued at a specific time in the future.
   * @param queueOrTopic - Name of the target queue or topic.
   * @param body - Message payload.
   * @param enqueueAt - Date and time when the message should become available.
   * @param options - Optional message metadata.
   * @returns Sequence numbers that can be used with `cancelScheduled()`.
   *
   * @example
   * const [seqNum] = await this.sb.schedule('reminders', { userId }, tomorrow);
   * // Later, if the user acts before the reminder fires:
   * await this.sb.cancelScheduled('reminders', seqNum);
   */
  async schedule(
    queueOrTopic: string,
    body: unknown,
    enqueueAt: Date,
    options?: ServiceBusMessageOptions,
  ): Promise<bigint[]> {
    const sender = this.getSender(queueOrTopic);
    return sender.scheduleMessages(this.buildMessage(body, options), enqueueAt);
  }

  /**
   * Cancels a previously scheduled message before it is enqueued.
   * @param queueOrTopic - Name of the queue or topic where the message was scheduled.
   * @param sequenceNumber - Sequence number returned by `schedule()`.
   */
  async cancelScheduled(queueOrTopic: string, sequenceNumber: bigint): Promise<void> {
    const sender = this.getSender(queueOrTopic);
    await sender.cancelScheduledMessages([sequenceNumber]);
  }

  async onModuleDestroy(): Promise<void> {
    for (const sender of this.senders.values()) {
      await sender.close();
    }
    await this.client.close();
  }

  private getSender(queueOrTopic: string): ServiceBusSender {
    if (!this.senders.has(queueOrTopic)) {
      this.senders.set(queueOrTopic, this.client.createSender(queueOrTopic));
    }
    return this.senders.get(queueOrTopic)!;
  }

  private buildMessage(body: unknown, options?: ServiceBusMessageOptions): ServiceBusMessage {
    return {
      body,
      messageId: options?.messageId,
      correlationId: options?.correlationId,
      contentType: options?.contentType,
      subject: options?.subject,
      applicationProperties: options?.applicationProperties,
    };
  }
}
