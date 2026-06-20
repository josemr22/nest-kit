import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import type { TokenCredential } from '@azure/identity';
import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { STORAGE_CLIENT, STORAGE_MODULE_OPTIONS } from './storage.constants';
import { StorageService } from './services/storage.service';

/**
 * Configuration options for StorageModule.
 * Accepts a connection string, account name + key, or account name + Entra ID.
 *
 * @example
 * // Connection string (SAS key auth)
 * { connectionString: 'DefaultEndpointsProtocol=https;AccountName=...' }
 *
 * // Account name + key (shared key auth)
 * { storageAccountName: 'myaccount', storageAccountKey: 'base64key==' }
 *
 * // Account name + Microsoft Entra ID (no keys; managed identity / az login)
 * { storageAccountName: 'myaccount' }
 * { storageAccountName: 'myaccount', credential: new ManagedIdentityCredential() }
 *
 * Note: `generateSasUrl()` requires shared key auth and is not available with
 * Entra ID. All other operations (upload, download, delete, list) work with any
 * strategy; public-container URLs returned by uploads never need a SAS.
 */
export type StorageModuleOptions =
  | { connectionString: string }
  | { storageAccountName: string; storageAccountKey: string }
  | { storageAccountName: string; credential?: TokenCredential };

/** Async configuration options for StorageModule, compatible with ConfigService. */
export interface StorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useFactory: (...args: any[]) => StorageModuleOptions | Promise<StorageModuleOptions>;
}

export function createBlobServiceClient(opts: StorageModuleOptions): BlobServiceClient {
  if ('connectionString' in opts) {
    return BlobServiceClient.fromConnectionString(opts.connectionString);
  }

  const accountUrl = `https://${opts.storageAccountName}.blob.core.windows.net`;

  if ('storageAccountKey' in opts) {
    return new BlobServiceClient(
      accountUrl,
      new StorageSharedKeyCredential(opts.storageAccountName, opts.storageAccountKey),
    );
  }

  // Entra ID: use the provided credential, or DefaultAzureCredential.
  // Lazy require so consumers using key/connection-string auth don't need @azure/identity.
  const credential =
    opts.credential ?? new (require('@azure/identity').DefaultAzureCredential)();
  return new BlobServiceClient(accountUrl, credential);
}

@Global()
@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        { provide: STORAGE_CLIENT, useValue: createBlobServiceClient(options) },
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
      useFactory: (opts: StorageModuleOptions) => createBlobServiceClient(opts),
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
