import {
  ConsoleLogger,
  Inject,
  Injectable,
  Scope,
} from '@nestjs/common';
import { KnownSeverityLevel, TelemetryClient } from 'applicationinsights';
import { AsyncLocalStorage } from 'async_hooks';
import { LOGGER_CLIENT } from '../logger.constants';

export interface LogMetadata {
  [key: string]: any;
}

export interface RequestContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  ip?: string;
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

  log(message: any, metadata?: LogMetadata): void;
  log(message: any, context?: string): void;
  log(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Information,
    });

    super.log(message, context || this.context);
  }

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

    this.appInsights.trackException({
      exception: error,
      properties,
      severity: KnownSeverityLevel.Error,
    });

    super.error(message, stack, context || this.context);
  }

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

    this.appInsights.trackException({
      exception: error,
      properties,
      severity: KnownSeverityLevel.Critical,
    });

    super.error(message, stack, context || this.context);
  }

  warn(message: any, metadata?: LogMetadata): void;
  warn(message: any, context?: string): void;
  warn(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Warning,
    });

    super.warn(message, context || this.context);
  }

  debug(message: any, metadata?: LogMetadata): void;
  debug(message: any, context?: string): void;
  debug(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Verbose,
    });

    super.debug(message, context || this.context);
  }

  verbose(message: any, metadata?: LogMetadata): void;
  verbose(message: any, context?: string): void;
  verbose(message: any, metadataOrContext?: LogMetadata | string): void {
    const isContext = typeof metadataOrContext === 'string';
    const metadata = !isContext ? metadataOrContext : undefined;
    const context = isContext ? metadataOrContext : undefined;

    const formattedMessage = this.formatLogMessage(message);
    const properties = this.buildProperties(metadata);

    this.appInsights.trackTrace({
      message: formattedMessage,
      properties,
      severity: KnownSeverityLevel.Verbose,
    });

    super.verbose(message, context || this.context);
  }

  fatal(message: any, metadata?: LogMetadata): void;
  fatal(message: any, stack?: string, context?: string): void;
  fatal(
    message: any,
    stackOrMetadata?: string | LogMetadata,
    context?: string,
  ): void {
    this.critical(message, stackOrMetadata as any, context);
  }

  trackEvent(name: string, properties?: LogMetadata, measurements?: Record<string, number>): void {
    this.appInsights.trackEvent({
      name,
      properties: this.buildProperties(properties),
      measurements,
    });
  }

  trackMetric(name: string, value: number, properties?: LogMetadata): void {
    this.appInsights.trackMetric({
      name,
      value,
      properties: this.buildProperties(properties),
    });
  }

  trackDependency(
    name: string,
    duration: number,
    success: boolean,
    resultCode?: number | string,
    dependencyType?: string,
    data?: string,
    properties?: LogMetadata,
  ): void {
    this.appInsights.trackDependency({
      name,
      duration,
      success,
      resultCode:
        resultCode !== undefined ? String(resultCode) : success ? '200' : '500',
      dependencyTypeName: dependencyType,
      data,
      properties: this.buildProperties(properties),
    });
  }
}
