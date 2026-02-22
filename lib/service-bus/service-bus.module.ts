import { ServiceBusClient } from '@azure/service-bus';
import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { SERVICE_BUS_CLIENT, SERVICE_BUS_MODULE_OPTIONS } from './service-bus.constants';
import { ServiceBusService } from './services/service-bus.service';

export interface ServiceBusModuleOptions {
  connectionString: string;
}

export interface ServiceBusModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => ServiceBusModuleOptions | Promise<ServiceBusModuleOptions>;
}

@Global()
@Module({})
export class ServiceBusModule {
  static forRoot(options: ServiceBusModuleOptions): DynamicModule {
    return {
      module: ServiceBusModule,
      providers: [
        { provide: SERVICE_BUS_CLIENT, useValue: new ServiceBusClient(options.connectionString) },
        ServiceBusService,
      ],
      exports: [ServiceBusService],
    };
  }

  static forRootAsync(options: ServiceBusModuleAsyncOptions): DynamicModule {
    const optionsProvider = {
      provide: SERVICE_BUS_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const clientProvider = {
      provide: SERVICE_BUS_CLIENT,
      useFactory: (opts: ServiceBusModuleOptions) => new ServiceBusClient(opts.connectionString),
      inject: [SERVICE_BUS_MODULE_OPTIONS],
    };

    return {
      module: ServiceBusModule,
      imports: options.imports || [],
      providers: [optionsProvider, clientProvider, ServiceBusService],
      exports: [ServiceBusService],
    };
  }
}
