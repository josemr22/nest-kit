import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import * as appInsights from 'applicationinsights';
import { LOGGER_CLIENT, LOGGER_MODULE_OPTIONS } from './logger.constants';
import { LoggerService } from './services/logger.service';

/** Configuration options for LoggerModule. */
export interface LoggerModuleOptions {
  /** Azure Application Insights connection string. */
  appInsightConnectionString: string;
}

/** Async configuration options for LoggerModule, compatible with ConfigService. */
export interface LoggerModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => LoggerModuleOptions | Promise<LoggerModuleOptions>;
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    const clientProvider = {
      provide: LOGGER_CLIENT,
      useFactory: () => {
        appInsights.setup(options.appInsightConnectionString);
        appInsights.start();
        return appInsights.defaultClient;
      },
    };

    return {
      module: LoggerModule,
      providers: [clientProvider, LoggerService],
      exports: [LoggerService],
    };
  }

  static forRootAsync(options: LoggerModuleAsyncOptions): DynamicModule {
    const optionsProvider = {
      provide: LOGGER_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const clientProvider = {
      provide: LOGGER_CLIENT,
      useFactory: (opts: LoggerModuleOptions) => {
        appInsights.setup(opts.appInsightConnectionString);
        appInsights.start();
        return appInsights.defaultClient;
      },
      inject: [LOGGER_MODULE_OPTIONS],
    };

    return {
      module: LoggerModule,
      imports: options.imports || [],
      providers: [optionsProvider, clientProvider, LoggerService],
      exports: [LoggerService],
    };
  }
}
