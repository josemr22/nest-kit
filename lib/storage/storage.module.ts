import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DynamicModule, Module } from '@nestjs/common';
import { StorageService } from './services/storage.service';

export interface StorageModuleOptions {
    storageAccountName: string;
    storageAccountKey: string;
}

@Module({})
export class StorageModule {
    static forRoot(options: StorageModuleOptions): DynamicModule {
        const { storageAccountName, storageAccountKey } = options;

        const storageProvider = {
            provide: 'StorageClient',
            useFactory: () => {
                return new BlobServiceClient(
                    `https://${storageAccountName}.blob.core.windows.net`,
                    new StorageSharedKeyCredential(storageAccountName, storageAccountKey),
                );
            },
        };

        return {
            module: StorageModule,
            providers: [storageProvider, StorageService],
            exports: [StorageService],
        };
    }
}