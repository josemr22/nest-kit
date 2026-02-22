import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { STORAGE_CLIENT, STORAGE_MODULE_OPTIONS } from './storage.constants';
import { StorageService } from './services/storage.service';

/**
 * Configuration options for StorageModule.
 * Accepts either a connection string or account name + key.
 *
 * @example
 * // Connection string (recommended for dev/CI)
 * { connectionString: 'DefaultEndpointsProtocol=https;AccountName=...' }
 *
 * // Account name + key
 * { storageAccountName: 'myaccount', storageAccountKey: 'base64key==' }
 */
export type StorageModuleOptions =
  | { connectionString: string }
  | { storageAccountName: string; storageAccountKey: string };

/** Async configuration options for StorageModule, compatible with ConfigService. */
export interface StorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => StorageModuleOptions | Promise<StorageModuleOptions>;
}

function createClient(opts: StorageModuleOptions): BlobServiceClient {
  if ('connectionString' in opts) {
    return BlobServiceClient.fromConnectionString(opts.connectionString);
  }
  return new BlobServiceClient(
    `https://${opts.storageAccountName}.blob.core.windows.net`,
    new StorageSharedKeyCredential(opts.storageAccountName, opts.storageAccountKey),
  );
}

@Global()
@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        { provide: STORAGE_CLIENT, useValue: createClient(options) },
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    const optionsProvider = {
      provide: STORAGE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const clientProvider = {
      provide: STORAGE_CLIENT,
      useFactory: (opts: StorageModuleOptions) => createClient(opts),
      inject: [STORAGE_MODULE_OPTIONS],
    };

    return {
      module: StorageModule,
      imports: options.imports || [],
      providers: [optionsProvider, clientProvider, StorageService],
      exports: [StorageService],
    };
  }
}
