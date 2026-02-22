import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DynamicModule, Global, Module, ModuleMetadata } from '@nestjs/common';
import { STORAGE_CLIENT, STORAGE_MODULE_OPTIONS } from './storage.constants';
import { StorageService } from './services/storage.service';

export interface StorageModuleOptions {
    storageAccountName: string;
    storageAccountKey: string;
}

export interface StorageModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    inject?: any[];
    useFactory: (...args: any[]) => StorageModuleOptions | Promise<StorageModuleOptions>;
}

@Global()
@Module({})
export class StorageModule {
    static forRoot(options: StorageModuleOptions): DynamicModule {
        const { storageAccountName, storageAccountKey } = options;

        const clientProvider = {
            provide: STORAGE_CLIENT,
            useFactory: () => {
                return new BlobServiceClient(
                    `https://${storageAccountName}.blob.core.windows.net`,
                    new StorageSharedKeyCredential(storageAccountName, storageAccountKey),
                );
            },
        };

        return {
            module: StorageModule,
            providers: [clientProvider, StorageService],
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
            useFactory: (opts: StorageModuleOptions) => {
                return new BlobServiceClient(
                    `https://${opts.storageAccountName}.blob.core.windows.net`,
                    new StorageSharedKeyCredential(opts.storageAccountName, opts.storageAccountKey),
                );
            },
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
