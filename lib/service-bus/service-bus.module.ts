import { ServiceBusClient } from '@azure/service-bus';
import type { TokenCredential } from '@azure/identity';
import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { SERVICE_BUS_CLIENT, SERVICE_BUS_MODULE_OPTIONS } from './service-bus.constants';
import { ServiceBusService } from './services/service-bus.service';

/**
 * Configuration options for ServiceBusModule.
 *
 * Provide either `fullyQualifiedNamespace` (Microsoft Entra ID auth) or
 * `connectionString` (SAS key auth). When both are present, the namespace
 * takes precedence.
 */
export interface ServiceBusModuleOptions {
  /** Azure Service Bus connection string (SAS key auth). */
  connectionString?: string;
  /**
   * Fully qualified namespace, e.g. `my-namespace.servicebus.windows.net`.
   * Enables Entra ID auth via the provided `credential` (or `DefaultAzureCredential`).
   */
  fullyQualifiedNamespace?: string;
  /**
   * Token credential used with `fullyQualifiedNamespace`.
   * Defaults to `DefaultAzureCredential` when omitted.
   */
  credential?: TokenCredential;
}

/**
 * Builds a ServiceBusClient from the given options, preferring Entra ID
 * (namespace + credential) over a SAS connection string.
 */
export function createServiceBusClient(options: ServiceBusModuleOptions): ServiceBusClient {
  if (options.fullyQualifiedNamespace) {
    // Lazy require so consumers using connection strings don't need @azure/identity installed.
    const credential =
      options.credential ??
      new (require('@azure/identity').DefaultAzureCredential)();
    return new ServiceBusClient(options.fullyQualifiedNamespace, credential);
  }

  if (options.connectionString) {
    return new ServiceBusClient(options.connectionString);
  }

  throw new Error(
    'ServiceBusModule: provide fullyQualifiedNamespace (Entra ID) or connectionString',
  );
}

/** Async configuration options for ServiceBusModule, compatible with ConfigService. */
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
        { provide: SERVICE_BUS_CLIENT, useValue: createServiceBusClient(options) },
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
      useFactory: (opts: ServiceBusModuleOptions) => createServiceBusClient(opts),
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
