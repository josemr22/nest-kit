import { BlobServiceClient } from '@azure/storage-blob';
import { Inject, Injectable } from '@nestjs/common';
import { StringsHelper } from '../../helpers/strings.helper';

@Injectable()
export class StorageService {

    constructor(
        @Inject('StorageClient') private readonly storageClient: BlobServiceClient,
    ) { }

    async uploadBuffer({
        containerName,
        buffer,
        blobName,
    }: {
        containerName: string;
        buffer: Buffer;
        blobName?: string;
    }) {
        const containerClient = this.storageClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(buffer);
        return {
            url: blockBlobClient.url
        };
    }

    async uploadFile({
        file,
        fileName,
        containerName,
    }: {
        file: Express.Multer.File;
        fileName?: string;
        containerName: string;
    }){
        const buffer = file.buffer;
        const originalName = file.originalname; 
        const extension = originalName.split('.').pop();
        const uniqueBlobName = this.getUniqueFileName(fileName || originalName.split('.').at(0)) + `.${extension}`;
        return this.uploadBuffer({ containerName, buffer, blobName: uniqueBlobName });
    }

    private getUniqueFileName(name: string): string {
        const uniqueSuffix = `${Math.round(Math.random() * 1E9)}`;
        return `${StringsHelper.toLowerSnakeCase(name)}_${uniqueSuffix}`;
    }
}
