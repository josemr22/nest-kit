import {
  ConsoleLogger,
  Inject,
  Injectable,
  Scope,
} from '@nestjs/common';
import { KnownSeverityLevel, TelemetryClient } from 'applicationinsights';
import { AsyncLocalStorage } from 'async_hooks';
import { LOGGER_CLIENT } from '../logger.constants';

/** Arbitrary key-value metadata attached to a log entry or telemetry event. */
export interface LogMetadata {
  [key: string]: any;
}

/**
 * HTTP request context propagated via AsyncLocalStorage.
 * Set once in a middleware or interceptor via `LoggerService.setRequestContext`;
 * all subsequent log calls within that async scope will include these fields automatically.
 *
 * Supports arbitrary extra fields via the index signature.
 */
export interface RequestContext {
  /** Unique request identifier for cross-service correlation. */
  requestId?: string;
  /** Authenticated user ID. */
  userId?: string;
  /** HTTP method (GET, POST, …). */
  method?: string;
  /** Request URL. */
  url?: string;
  /** Client IP address. */
  ip?: string;
  /** User-Agent header value. */
  userAgent?: string;
  [key: string]: any;
}

@Injectable({
  scope: Scope.TRANSIENT,
})
export class LoggerService extends ConsoleLogger {
  private static asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  constructor(
    @Inject(LOGGER_CLIENT) private readonly appInsights: TelemetryClient,
  ) {
    super();
  }

  /**
   * Runs `callback` within an async context that carries the given `RequestContext`.
   * Any `LoggerService` call made inside `callback` (or any function it calls)
   * will automatically include the context fields in Application Insights properties.
   *
   * Typically called once per request in a NestJS middleware or interceptor.
   *
   * @example
   * // In a middleware:
   * LoggerService.setRequestContext(
   *   { requestId: req.id, userId: req.user?.id, method: req.method, url: req.url },
   *   () => next(),
   * );
   */
  static setRequestContext(context: RequestContext, callback: () => void) {
    LoggerService.asyncLocalStorage.run(context, callback);
  }

  private getRequestContext(): RequestContext {
    return LoggerService.asyncLocalStorage.getStore() || {};
  }

  private buildProperties(metadata?: LogMetadata): Record<string, any> {
    const requestContext = this.getRequestContext();
    const contextName = this.context;

    return {
      context: contextName,
      timestamp: new Date().toISOString(),
      ...requestContext,
      ...(metadata || {}),
    };
  }

  private trackSafely(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      console.warn('[nest-kit] Telemetry export failed (ignored):', err);
    }
  }

  private formatLogMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private extractError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }
    if (typeof error === 'string') {
      return new Error(error);
    }
    if (error?.message) {
      const err = new Error(error.message);
      if (error.stack) err.stack = error.stack;
      return err;
    }
    return new Error(this.formatLogMessage(error));
  }

  /** Logs an informational message. Sends a `trackTrace` with severity Information. */
  log(message: any, metadata?: LogMetadata): void;
  log(message: any, context?: string): void;
  log(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.trackSafely(() => this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Information,
    }));

    super.log(message, context || this.context);
  }

  /** Logs an error. Sends a `trackException` with severity Error. */
  error(message: any, metadata?: LogMetadata): void;
  error(message: any, stackOrContext?: string): void;
  error(message: any, stack?: string, context?: string, metadata?: LogMetadata): void;
  error(
    message: any,
    stackOrMetadata?: string | LogMetadata,
    context?: string,
    metadata?: LogMetadata,
  ): void {
    const isMetadata =
      typeof stackOrMetadata === 'object' && stackOrMetadata !== null;
    const actualMetadata = isMetadata ? stackOrMetadata : metadata || undefined;
    const stack = !isMetadata ? stackOrMetadata : undefined;

    const error = this.extractError(message);
    const properties = this.buildProperties(actualMetadata);

    this.trackSafely(() => this.appInsights.trackException({
      exception: error,
      properties,
      severity: KnownSeverityLevel.Error,
    }));

    super.error(message, stack, context || this.context);
  }

  /** Logs a critical error. Sends a `trackException` with severity Critical. */
  critical(message: any, metadata?: LogMetadata): void;
  critical(message: any, stack?: string, context?: string): void;
  critical(
    message: any,
    stackOrMetadata?: string | LogMetadata,
    context?: string,
  ): void {
    const isMetadata =
      typeof stackOrMetadata === 'object' && stackOrMetadata !== null;
    const metadata = isMetadata ? stackOrMetadata : undefined;
    const stack = !isMetadata ? stackOrMetadata : undefined;

    const error = this.extractError(message);
    const properties = this.buildProperties(metadata);

    this.trackSafely(() => this.appInsights.trackException({
      exception: error,
      properties,
      severity: KnownSeverityLevel.Critical,
    }));

    super.error(message, stack, context || this.context);
  }

  /** Logs a warning. Sends a `trackTrace` with severity Warning. */
  warn(message: any, metadata?: LogMetadata): void;
  warn(message: any, context?: string): void;
  warn(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.trackSafely(() => this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Warning,
    }));

    super.warn(message, context || this.context);
  }

  /** Logs a debug message. Sends a `trackTrace` with severity Verbose. */
  debug(message: any, metadata?: LogMetadata): void;
  debug(message: any, context?: string): void;
  debug(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.trackSafely(() => this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Verbose,
    }));

    super.debug(message, context || this.context);
  }

  /** Logs a verbose message. Sends a `trackTrace` with severity Verbose. */
  verbose(message: any, metadata?: LogMetadata): void;
  verbose(message: any, context?: string): void;
  verbose(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.trackSafely(() => this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Verbose,
    }));

    super.verbose(message, context || this.context);
  }

  /** Alias for `critical()`. */
  fatal(message: any, metadata?: LogMetadata): void;
  fatal(message: any, stack?: string, context?: string): void;
  fatal(
    message: any,
    stackOrMetadata?: string | LogMetadata,
    context?: string,
  ): void {
    this.critical(message, stackOrMetadata as any, context);
  }

  /**
   * Tracks a custom business event in Application Insights.
   * @param name - Event name (e.g. `'UserRegistered'`).
   * @param properties - Arbitrary string/number/boolean key-value pairs.
   * @param measurements - Numeric measurements associated with the event (e.g. `{ duration: 120 }`).
   */
  trackEvent(name: string, properties?: LogMetadata, measurements?: Record<string, number>): void {
    this.trackSafely(() => this.appInsights.trackEvent({
      name,
      properties: this.buildProperties(properties),
      measurements,
    }));
  }

  /**
   * Tracks a custom numeric metric in Application Insights.
   * @param name - Metric name (e.g. `'ResponseTime'`).
   * @param value - Numeric value.
   */
  trackMetric(name: string, value: number, properties?: LogMetadata): void {
    this.trackSafely(() => this.appInsights.trackMetric({
      name,
      value,
      properties: this.buildProperties(properties),
    }));
  }

  /**
   * Tracks an outgoing dependency call (HTTP, DB, cache, etc.) in Application Insights.
   * @param name - Dependency name (e.g. `'UserService'`, `'Redis'`).
   * @param duration - Call duration in milliseconds.
   * @param success - Whether the call succeeded.
   * @param resultCode - HTTP status or error code. Defaults to `'200'` / `'500'`.
   * @param dependencyType - Type label (e.g. `'HTTP'`, `'SQL'`, `'Cache'`).
   * @param data - Command or URL that was called (e.g. `'GET /users'`, `'SELECT * FROM users'`).
   */
  trackDependency(
    name: string,
    duration: number,
    success: boolean,
    resultCode?: number | string,
    dependencyType?: string,
    data?: string,
    properties?: LogMetadata,
  ): void {
    this.trackSafely(() => this.appInsights.trackDependency({
      name,
      duration,
      success,
      resultCode:
        resultCode !== undefined ? String(resultCode) : success ? '200' : '500',
      dependencyTypeName: dependencyType,
      data,
      properties: this.buildProperties(properties),
    }));
  }
}
