import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { BlobSASPermissions, BlobServiceClient } from '@azure/storage-blob';
import { toLowerSnakeCase } from '../../helpers/strings';
import { STORAGE_CLIENT } from '../storage.constants';

/** Result returned by upload operations. */
export interface UploadResult {
  /** Full public URL of the blob in Azure Blob Storage. */
  url: string;
  /**
   * Resolved blob name, including any virtual folder prefix.
   * Store this in your database to reference or delete the blob later.
   */
  blobName: string;
}

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: BlobServiceClient,
  ) {}

  /**
   * Uploads a raw `Buffer` to a container.
   * @param containerName - Target Azure Blob Storage container.
   * @param buffer - Binary data to upload.
   * @param blobName - Blob name. If omitted, a unique name is auto-generated.
   * @param contentType - MIME type set in `blobHTTPHeaders` (e.g. `'application/pdf'`).
   *   Without this, Azure serves the blob as `application/octet-stream`.
   * @param folder - Virtual directory prefix (e.g. `'reports/2024'`).
   *   The final blob path will be `folder/blobName`.
   */
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

  /**
   * Uploads a Multer file to a container.
   * The `file.mimetype` is automatically set as the blob content type.
   * A UUID suffix is always appended to the blob name to prevent collisions.
   *
   * @param containerName - Target Azure Blob Storage container.
   * @param file - Multer file object (must use `memoryStorage`).
   * @param blobName - Custom base name (without extension). Defaults to the original filename base.
   * @param folder - Virtual directory prefix (e.g. `'avatars'`).
   */
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

  /**
   * Deletes a blob from a container.
   * Pass the `blobName` returned by a previous upload to target the correct blob.
   */
  async deleteBlob(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    await containerClient.deleteBlob(blobName);
  }

  /** Returns `true` if the blob exists in the given container. */
  async blobExists(containerName: string, blobName: string): Promise<boolean> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    return containerClient.getBlockBlobClient(blobName).exists();
  }

  /** Downloads a blob and returns its content as a `Buffer`. */
  async downloadToBuffer(containerName: string, blobName: string): Promise<Buffer> {
    const containerClient = this.storageClient.getContainerClient(containerName);
    return containerClient.getBlockBlobClient(blobName).downloadToBuffer();
  }

  /**
   * Generates a read-only Shared Access Signature (SAS) URL for temporary blob access.
   * Useful for granting time-limited access to blobs in private containers.
   *
   * **Requires** the module to be configured with `storageAccountName` + `storageAccountKey`.
   * Does not work with connection strings that use SAS tokens or Managed Identity.
   *
   * @param containerName - Container where the blob lives.
   * @param blobName - Blob name (use the value returned by upload methods).
   * @param expiresInMinutes - How long the URL should remain valid.
   */
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

  /**
   * Lists all blob names in a container, optionally filtered by a prefix.
   * @param containerName - Container to list.
   * @param prefix - Optional prefix to filter results (e.g. `'avatars/'` to list a virtual folder).
   */
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
    const safeName = toLowerSnakeCase(base);
    const id = randomUUID().replace(/-/g, '');
    return ext ? `${safeName}_${id}.${ext}` : `${safeName}_${id}`;
  }
}
