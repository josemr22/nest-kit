import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import { StringsHelper } from '../../helpers/strings.helper';
import { STORAGE_CLIENT } from '../storage.constants';

export interface UploadResult {
  url: string;
  blobName: string;
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: BlobServiceClient,
  ) {}

  async uploadBuffer({
    containerName,
    buffer,
    blobName,
    contentType,
  }: {
    containerName: string;
    buffer: Buffer;
    blobName?: string;
    contentType?: string;
  }): Promise<UploadResult> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    const resolvedBlobName = blobName ?? this.generateBlobName('blob');
    const blockBlobClient = containerClient.getBlockBlobClient(resolvedBlobName);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
    });

    return { url: blockBlobClient.url, blobName: resolvedBlobName };
  }

  async uploadFile({
    file,
    blobName,
    containerName,
  }: {
    file: Express.Multer.File;
    blobName?: string;
    containerName: string;
  }): Promise<UploadResult> {
    const { base, ext } = this.parseFilename(file.originalname);
    const resolvedBlobName = this.generateBlobName(blobName ?? base, ext);

    return this.uploadBuffer({
      containerName,
      buffer: file.buffer,
      blobName: resolvedBlobName,
      contentType: file.mimetype,
    });
  }

  async deleteBlob(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    await containerClient.deleteBlob(blobName);
  }

  private parseFilename(filename: string): { base: string; ext: string } {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return { base: filename, ext: '' };
    return {
      base: filename.slice(0, lastDot),
      ext: filename.slice(lastDot + 1),
    };
  }

  private generateBlobName(base: string, ext?: string): string {
    const safeName = StringsHelper.toLowerSnakeCase(base);
    const id = randomUUID().replace(/-/g, '');
    return ext ? `${safeName}_${id}.${ext}` : `${safeName}_${id}`;
  }
}
