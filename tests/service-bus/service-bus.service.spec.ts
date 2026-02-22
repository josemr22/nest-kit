import { Test } from '@nestjs/testing';
import { SERVICE_BUS_CLIENT } from '../../lib/service-bus/service-bus.constants';
import { ServiceBusService } from '../../lib/service-bus/services/service-bus.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockSender = {
  sendMessages: jest.fn().mockResolvedValue(undefined),
  scheduleMessages: jest.fn().mockResolvedValue([BigInt(1)]),
  cancelScheduledMessages: jest.fn().mockResolvedValue(undefined),
  createMessageBatch: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockClient = {
  createSender: jest.fn().mockReturnValue(mockSender),
  close: jest.fn().mockResolvedValue(undefined),
};

async function createService(): Promise<ServiceBusService> {
  const module = await Test.createTestingModule({
    providers: [
      ServiceBusService,
      { provide: SERVICE_BUS_CLIENT, useValue: mockClient },
    ],
  }).compile();

  return module.get(ServiceBusService);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ServiceBusService', () => {
  let service: ServiceBusService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockClient.createSender.mockReturnValue(mockSender);
    mockSender.sendMessages.mockResolvedValue(undefined);
    mockSender.scheduleMessages.mockResolvedValue([BigInt(1)]);
    mockSender.cancelScheduledMessages.mockResolvedValue(undefined);
    mockSender.close.mockResolvedValue(undefined);
    mockClient.close.mockResolvedValue(undefined);

    service = await createService();
  });

  // ─── send ─────────────────────────────────────────────────────────────────

  describe('send()', () => {
    it('crea un sender para la queue indicada', async () => {
      await service.send('orders-queue', { orderId: '1' });

      expect(mockClient.createSender).toHaveBeenCalledWith('orders-queue');
    });

    it('llama sendMessages con el body correcto', async () => {
      await service.send('orders-queue', { orderId: '1' });

      expect(mockSender.sendMessages).toHaveBeenCalledWith(
        expect.objectContaining({ body: { orderId: '1' } }),
      );
    });

    it('incluye options en el mensaje cuando se proporcionan', async () => {
      await service.send('orders-queue', { orderId: '1' }, {
        messageId: 'msg-123',
        correlationId: 'corr-456',
        contentType: 'application/json',
        subject: 'OrderCreated',
        applicationProperties: { source: 'api' },
      });

      expect(mockSender.sendMessages).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-123',
          correlationId: 'corr-456',
          contentType: 'application/json',
          subject: 'OrderCreated',
          applicationProperties: { source: 'api' },
        }),
      );
    });

    it('reutiliza el mismo sender en llamadas sucesivas a la misma queue', async () => {
      await service.send('orders-queue', { orderId: '1' });
      await service.send('orders-queue', { orderId: '2' });

      expect(mockClient.createSender).toHaveBeenCalledTimes(1);
    });

    it('crea senders distintos para queues distintas', async () => {
      await service.send('orders-queue', { orderId: '1' });
      await service.send('payments-queue', { paymentId: '1' });

      expect(mockClient.createSender).toHaveBeenCalledTimes(2);
      expect(mockClient.createSender).toHaveBeenCalledWith('orders-queue');
      expect(mockClient.createSender).toHaveBeenCalledWith('payments-queue');
    });
  });

  // ─── sendBatch ────────────────────────────────────────────────────────────

  describe('sendBatch()', () => {
    function makeBatch(capacity = Infinity) {
      let count = 0;
      return {
        tryAddMessage: jest.fn().mockImplementation(() => count++ < capacity),
        get count() { return count; },
        _isServiceBusMessageBatch: true,
      };
    }

    it('envía todos los mensajes en un batch cuando caben', async () => {
      const batch = makeBatch();
      mockSender.createMessageBatch.mockResolvedValue(batch);

      await service.sendBatch('orders-queue', [{ id: 1 }, { id: 2 }, { id: 3 }]);

      expect(batch.tryAddMessage).toHaveBeenCalledTimes(3);
      expect(mockSender.sendMessages).toHaveBeenCalledTimes(1);
      expect(mockSender.sendMessages).toHaveBeenCalledWith(batch);
    });

    it('divide automáticamente en múltiples batches cuando el primero se llena', async () => {
      const batch1 = makeBatch(2); // acepta los 2 primeros
      const batch2 = makeBatch();  // acepta el tercero
      mockSender.createMessageBatch
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);

      await service.sendBatch('orders-queue', [{ id: 1 }, { id: 2 }, { id: 3 }]);

      expect(mockSender.sendMessages).toHaveBeenCalledTimes(2);
      expect(mockSender.sendMessages).toHaveBeenNthCalledWith(1, batch1);
      expect(mockSender.sendMessages).toHaveBeenNthCalledWith(2, batch2);
    });

    it('no llama sendMessages si el array está vacío', async () => {
      const batch = makeBatch();
      mockSender.createMessageBatch.mockResolvedValue(batch);

      await service.sendBatch('orders-queue', []);

      expect(mockSender.sendMessages).not.toHaveBeenCalled();
    });
  });

  // ─── schedule ─────────────────────────────────────────────────────────────

  describe('schedule()', () => {
    it('retorna los sequence numbers del SDK', async () => {
      const expected = [BigInt(42)];
      mockSender.scheduleMessages.mockResolvedValue(expected);

      const result = await service.schedule('reminders-queue', { userId: '1' }, new Date());

      expect(result).toBe(expected);
    });

    it('llama scheduleMessages con el body y la fecha correctos', async () => {
      const enqueueAt = new Date('2026-03-01T10:00:00Z');
      await service.schedule('reminders-queue', { userId: '1' }, enqueueAt);

      expect(mockSender.scheduleMessages).toHaveBeenCalledWith(
        expect.objectContaining({ body: { userId: '1' } }),
        enqueueAt,
      );
    });

    it('incluye options en el mensaje programado', async () => {
      await service.schedule(
        'reminders-queue',
        { userId: '1' },
        new Date(),
        { messageId: 'sched-1', subject: 'Reminder' },
      );

      expect(mockSender.scheduleMessages).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'sched-1', subject: 'Reminder' }),
        expect.any(Date),
      );
    });
  });

  // ─── cancelScheduled ──────────────────────────────────────────────────────

  describe('cancelScheduled()', () => {
    it('llama cancelScheduledMessages con el sequence number correcto', async () => {
      await service.cancelScheduled('reminders-queue', BigInt(42));

      expect(mockSender.cancelScheduledMessages).toHaveBeenCalledWith([BigInt(42)]);
    });

    it('usa el sender de la queue correcta', async () => {
      await service.cancelScheduled('reminders-queue', BigInt(1));

      expect(mockClient.createSender).toHaveBeenCalledWith('reminders-queue');
    });
  });

  // ─── onModuleDestroy ──────────────────────────────────────────────────────

  describe('onModuleDestroy()', () => {
    it('cierra todos los senders abiertos', async () => {
      await service.send('queue-a', {});
      await service.send('queue-b', {});

      await service.onModuleDestroy();

      expect(mockSender.close).toHaveBeenCalledTimes(2);
    });

    it('cierra el client de Service Bus', async () => {
      await service.onModuleDestroy();

      expect(mockClient.close).toHaveBeenCalledTimes(1);
    });
  });
});
