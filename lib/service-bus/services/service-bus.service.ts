import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ServiceBusClient, ServiceBusMessage, ServiceBusSender } from '@azure/service-bus';
import { SERVICE_BUS_CLIENT } from '../service-bus.constants';

export interface ServiceBusMessageOptions {
  messageId?: string;
  correlationId?: string;
  contentType?: string;
  subject?: string;
  applicationProperties?: Record<string, string | number | boolean>;
}

@Injectable()
export class ServiceBusService implements OnModuleDestroy {
  private readonly senders = new Map<string, ServiceBusSender>();

  constructor(
    @Inject(SERVICE_BUS_CLIENT) private readonly client: ServiceBusClient,
  ) {}

  async send(
    queueOrTopic: string,
    body: unknown,
    options?: ServiceBusMessageOptions,
  ): Promise<void> {
    const sender = this.getSender(queueOrTopic);
    await sender.sendMessages(this.buildMessage(body, options));
  }

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

  async schedule(
    queueOrTopic: string,
    body: unknown,
    enqueueAt: Date,
    options?: ServiceBusMessageOptions,
  ): Promise<bigint[]> {
    const sender = this.getSender(queueOrTopic);
    return sender.scheduleMessages(this.buildMessage(body, options), enqueueAt);
  }

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
