import { Test } from '@nestjs/testing';
import { KnownSeverityLevel } from 'applicationinsights';
import { LOGGER_CLIENT } from '../../lib/logger/logger.constants';
import { LoggerService } from '../../lib/logger/services/logger.service';

const mockAppInsights = {
  trackTrace: jest.fn(),
  trackException: jest.fn(),
  trackEvent: jest.fn(),
  trackMetric: jest.fn(),
  trackDependency: jest.fn(),
};

async function createService(): Promise<LoggerService> {
  const module = await Test.createTestingModule({
    providers: [
      LoggerService,
      { provide: LOGGER_CLIENT, useValue: mockAppInsights },
    ],
  }).compile();

  return module.resolve(LoggerService);
}

describe('LoggerService', () => {
  let service: LoggerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createService();
    // Silence console output during tests
    jest.spyOn(service as any, 'printMessages').mockImplementation(() => {});
  });

  // ─── log() ────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('llama trackTrace con severidad Information', () => {
      service.log('hello');

      expect(mockAppInsights.trackTrace).toHaveBeenCalledTimes(1);
      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'hello',
          severity: KnownSeverityLevel.Information,
        }),
      );
    });

    it('serializa un objeto como mensaje', () => {
      service.log({ userId: 1 });

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({ message: '{"userId":1}' }),
      );
    });

    it('extrae el mensaje de un Error', () => {
      service.log(new Error('boom'));

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'boom' }),
      );
    });

    it('incluye metadata en las properties', () => {
      service.log('evento', { orderId: '123' });

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ orderId: '123' }),
        }),
      );
    });
  });

  // ─── error() ──────────────────────────────────────────────────────────────

  describe('error()', () => {
    it('llama trackException con severidad Error', () => {
      service.error('algo falló');

      expect(mockAppInsights.trackException).toHaveBeenCalledTimes(1);
      expect(mockAppInsights.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: KnownSeverityLevel.Error,
          exception: expect.any(Error),
        }),
      );
    });

    it('usa el Error original si se pasa un Error', () => {
      const err = new Error('db error');
      service.error(err);

      const call = mockAppInsights.trackException.mock.calls[0][0];
      expect(call.exception).toBe(err);
    });

    it('incluye metadata en las properties', () => {
      service.error('fallo', { requestId: 'abc' });

      expect(mockAppInsights.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({ requestId: 'abc' }),
        }),
      );
    });
  });

  // ─── critical() ───────────────────────────────────────────────────────────

  describe('critical()', () => {
    it('llama trackException con severidad Critical', () => {
      service.critical('error grave');

      expect(mockAppInsights.trackException).toHaveBeenCalledWith(
        expect.objectContaining({ severity: KnownSeverityLevel.Critical }),
      );
    });
  });

  // ─── warn() ───────────────────────────────────────────────────────────────

  describe('warn()', () => {
    it('llama trackTrace con severidad Warning', () => {
      service.warn('atención');

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({ severity: KnownSeverityLevel.Warning }),
      );
    });
  });

  // ─── debug() ──────────────────────────────────────────────────────────────

  describe('debug()', () => {
    it('llama trackTrace con severidad Verbose', () => {
      service.debug('valor interno');

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({ severity: KnownSeverityLevel.Verbose }),
      );
    });
  });

  // ─── verbose() ────────────────────────────────────────────────────────────

  describe('verbose()', () => {
    it('llama trackTrace con severidad Verbose', () => {
      service.verbose('detalle');

      expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
        expect.objectContaining({ severity: KnownSeverityLevel.Verbose }),
      );
    });
  });

  // ─── fatal() ──────────────────────────────────────────────────────────────

  describe('fatal()', () => {
    it('delega a critical()', () => {
      const criticalSpy = jest.spyOn(service, 'critical');
      service.fatal('sistema caído');

      expect(criticalSpy).toHaveBeenCalledWith('sistema caído', undefined, undefined);
    });
  });

  // ─── RequestContext ────────────────────────────────────────────────────────

  describe('RequestContext (AsyncLocalStorage)', () => {
    it('incluye el contexto del request en las properties', (done) => {
      LoggerService.setRequestContext(
        { requestId: 'req-1', userId: 'user-42', method: 'GET', url: '/api/test' },
        () => {
          service.log('dentro del contexto');

          expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
            expect.objectContaining({
              properties: expect.objectContaining({
                requestId: 'req-1',
                userId: 'user-42',
                method: 'GET',
                url: '/api/test',
              }),
            }),
          );
          done();
        },
      );
    });

    it('no incluye contexto fuera del async scope', () => {
      service.log('fuera del contexto');

      const call = mockAppInsights.trackTrace.mock.calls[0][0];
      expect(call.properties.requestId).toBeUndefined();
    });

    it('el metadata sobreescribe campos del contexto si hay colisión', (done) => {
      LoggerService.setRequestContext({ userId: 'original' }, () => {
        service.log('mensaje', { userId: 'override' });

        const call = mockAppInsights.trackTrace.mock.calls[0][0];
        expect(call.properties.userId).toBe('override');
        done();
      });
    });

    it('acepta campos extra vía index signature', (done) => {
      LoggerService.setRequestContext({ tenantId: 'tenant-xyz' }, () => {
        service.log('log con campo custom');

        expect(mockAppInsights.trackTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: expect.objectContaining({ tenantId: 'tenant-xyz' }),
          }),
        );
        done();
      });
    });
  });

  // ─── buildProperties ──────────────────────────────────────────────────────

  describe('buildProperties()', () => {
    it('siempre incluye timestamp en formato ISO', () => {
      service.log('test');

      const call = mockAppInsights.trackTrace.mock.calls[0][0];
      expect(call.properties.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('incluye el nombre del contexto (setContext)', () => {
      service.setContext('MiServicio');
      service.log('test');

      const call = mockAppInsights.trackTrace.mock.calls[0][0];
      expect(call.properties.context).toBe('MiServicio');
    });
  });

  // ─── Telemetría custom ────────────────────────────────────────────────────

  describe('trackEvent()', () => {
    it('llama appInsights.trackEvent con el nombre correcto', () => {
      service.trackEvent('UserCreated', { userId: '1' }, { duration: 42 });

      expect(mockAppInsights.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'UserCreated',
          measurements: { duration: 42 },
          properties: expect.objectContaining({ userId: '1' }),
        }),
      );
    });
  });

  describe('trackMetric()', () => {
    it('llama appInsights.trackMetric con nombre y valor', () => {
      service.trackMetric('ResponseTime', 320);

      expect(mockAppInsights.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'ResponseTime', value: 320 }),
      );
    });
  });

  describe('trackDependency()', () => {
    it('usa resultCode "200" cuando success=true y no se pasa resultCode', () => {
      service.trackDependency('ExternalAPI', 150, true);

      expect(mockAppInsights.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({ resultCode: '200', success: true }),
      );
    });

    it('usa resultCode "500" cuando success=false y no se pasa resultCode', () => {
      service.trackDependency('ExternalAPI', 150, false);

      expect(mockAppInsights.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({ resultCode: '500', success: false }),
      );
    });

    it('convierte resultCode numérico a string', () => {
      service.trackDependency('DB', 50, true, 201);

      expect(mockAppInsights.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({ resultCode: '201' }),
      );
    });

    it('pasa dependencyTypeName y data correctamente', () => {
      service.trackDependency('Redis', 10, true, 200, 'Cache', 'GET key');

      expect(mockAppInsights.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          dependencyTypeName: 'Cache',
          data: 'GET key',
        }),
      );
    });
  });
});
