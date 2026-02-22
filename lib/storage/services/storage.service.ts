import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';
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
    folder,
  }: {
    containerName: string;
    buffer: Buffer;
    blobName?: string;
    contentType?: string;
    folder?: string;
  }): Promise<UploadResult> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    const resolvedBlobName = this.resolveBlobPath(blobName ?? this.generateBlobName('blob'), folder);
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
    folder,
  }: {
    file: Express.Multer.File;
    blobName?: string;
    containerName: string;
    folder?: string;
  }): Promise<UploadResult> {
    const { base, ext } = this.parseFilename(file.originalname);
    const resolvedBlobName = this.generateBlobName(blobName ?? base, ext);

    return this.uploadBuffer({
      containerName,
      buffer: file.buffer,
      blobName: resolvedBlobName,
      contentType: file.mimetype,
      folder,
    });
  }

  async deleteBlob(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    await containerClient.deleteBlob(blobName);
  }

  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    return containerClient.getBlockBlobClient(blobName).exists();
  }

  async downloadToBuffer(containerName: string, blobName: string): Promise<Buffer> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    return containerClient.getBlockBlobClient(blobName).downloadToBuffer();
  }

  async generateSasUrl(
    containerName: string,
    blobName: string,
    expiresInMinutes: number,
  ): Promise<string> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const expiresOn = new Date(Date.now() + expiresInMinutes * 60_000);

    return blockBlobClient.generateSasUrl({
      permissions: BlobSASPermissions.parse('r'),
      expiresOn,
    });
  }

  async listBlobs(containerName: string, prefix?: string): Promise<string[]> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    const blobs: string[] = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }

    return blobs;
  }

  private parseFilename(filename: string): { base: string; ext: string } {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return { base: filename, ext: '' };
    return {
      base: filename.slice(0, lastDot),
      ext: filename.slice(lastDot + 1),
    };
  }

  private resolveBlobPath(blobName: string, folder?: string): string {
    if (!folder) return blobName;
    return `${folder.replace(/\/+$/, '')}/${blobName}`;
  }

  private generateBlobName(base: string, ext?: string): string {
    const safeName = StringsHelper.toLowerSnakeCase(base);
    const id = randomUUID().replace(/-/g, '');
    return ext ? `${safeName}_${id}.${ext}` : `${safeName}_${id}`;
  }
}
