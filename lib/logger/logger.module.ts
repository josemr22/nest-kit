import { DynamicModule, Module } from '@nestjs/common';
import * as appInsights from 'applicationinsights';
import { LoggerService } from './services/logger.service';

export interface LoggerModuleOptions {
  appInsightConnectionString: string;
}

@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    const appInsightProvider = {
      provide: 'ApplicationInsight',
      useFactory: () => {
        appInsights.setup(options.appInsightConnectionString);
        appInsights.start();
        return appInsights.defaultClient;
      },
    };

    return {
      module: LoggerModule,
      providers: [appInsightProvider, LoggerService],
      exports: [LoggerService],
    };
  }
}