import { Test } from '@nestjs/testing';
import { STORAGE_CLIENT } from '../../lib/storage/storage.constants';
import { StorageService } from '../../lib/storage/services/storage.service';

// ─── Mock factory ─────────────────────────────────────────────────────────────

const mockBlockBlobClient = {
  url: 'https://account.blob.core.windows.net/container/blob',
  uploadData: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(true),
  downloadToBuffer: jest.fn().mockResolvedValue(Buffer.from('content')),
  generateSasUrl: jest.fn().mockResolvedValue('https://sas-url'),
  deleteBlob: jest.fn().mockResolvedValue(undefined),
};

const mockContainerClient = {
  getBlockBlobClient: jest.fn().mockReturnValue(mockBlockBlobClient),
  deleteBlob: jest.fn().mockResolvedValue(undefined),
  listBlobsFlat: jest.fn(),
};

const mockStorageClient = {
  getContainerClient: jest.fn().mockReturnValue(mockContainerClient),
};

async function createService(): Promise<StorageService> {
  const module = await Test.createTestingModule({
    providers: [
      StorageService,
      { provide: STORAGE_CLIENT, useValue: mockStorageClient },
    ],
  }).compile();

  return module.get(StorageService);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMulterFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('image data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Restore default mock return values after clearAllMocks
    mockStorageClient.getContainerClient.mockReturnValue(mockContainerClient);
    mockContainerClient.getBlockBlobClient.mockReturnValue(mockBlockBlobClient);
    mockBlockBlobClient.uploadData.mockResolvedValue(undefined);
    mockBlockBlobClient.exists.mockResolvedValue(true);
    mockBlockBlobClient.downloadToBuffer.mockResolvedValue(Buffer.from('content'));
    mockBlockBlobClient.generateSasUrl.mockResolvedValue('https://sas-url');
    mockContainerClient.deleteBlob.mockResolvedValue(undefined);

    service = await createService();
  });

  // ─── uploadBuffer ──────────────────────────────────────────────────────────

  describe('uploadBuffer()', () => {
    it('llama uploadData con el buffer correcto', async () => {
      const buffer = Buffer.from('data');
      await service.uploadBuffer({ containerName: 'uploads', buffer });

      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
        buffer,
        expect.any(Object),
      );
    });

    it('retorna url y blobName', async () => {
      const result = await service.uploadBuffer({
        containerName: 'uploads',
        buffer: Buffer.from('x'),
      });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('blobName');
      expect(typeof result.url).toBe('string');
      expect(typeof result.blobName).toBe('string');
    });

    it('usa el blobName proporcionado si se pasa', async () => {
      await service.uploadBuffer({
        containerName: 'uploads',
        buffer: Buffer.from('x'),
        blobName: 'mi-archivo.pdf',
      });

      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('mi-archivo.pdf');
    });

    it('genera un blobName único si no se proporciona', async () => {
      await service.uploadBuffer({ containerName: 'uploads', buffer: Buffer.from('x') });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/^blob_[a-f0-9]{32}$/);
    });

    it('pasa contentType en blobHTTPHeaders cuando se proporciona', async () => {
      await service.uploadBuffer({
        containerName: 'uploads',
        buffer: Buffer.from('x'),
        contentType: 'application/pdf',
      });

      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          blobHTTPHeaders: { blobContentType: 'application/pdf' },
        }),
      );
    });

    it('no incluye blobHTTPHeaders si no se pasa contentType', async () => {
      await service.uploadBuffer({ containerName: 'uploads', buffer: Buffer.from('x') });

      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ blobHTTPHeaders: undefined }),
      );
    });

    it('prefija el blobName con el folder cuando se proporciona', async () => {
      await service.uploadBuffer({
        containerName: 'uploads',
        buffer: Buffer.from('x'),
        blobName: 'file.pdf',
        folder: 'reports/2024',
      });

      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('reports/2024/file.pdf');
    });

    it('normaliza el trailing slash del folder', async () => {
      await service.uploadBuffer({
        containerName: 'uploads',
        buffer: Buffer.from('x'),
        blobName: 'file.pdf',
        folder: 'reports/',
      });

      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('reports/file.pdf');
    });
  });

  // ─── uploadFile ────────────────────────────────────────────────────────────

  describe('uploadFile()', () => {
    it('extrae extensión y pasa mimetype como contentType', async () => {
      const file = makeMulterFile({ originalname: 'photo.jpg', mimetype: 'image/jpeg' });
      await service.uploadFile({ containerName: 'media', file });

      expect(mockBlockBlobClient.uploadData).toHaveBeenCalledWith(
        file.buffer,
        expect.objectContaining({
          blobHTTPHeaders: { blobContentType: 'image/jpeg' },
        }),
      );
    });

    it('el blobName generado incluye la extensión del archivo original', async () => {
      const file = makeMulterFile({ originalname: 'photo.jpg' });
      await service.uploadFile({ containerName: 'media', file });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/\.jpg$/);
    });

    it('usa blobName personalizado como base (mantiene extensión original)', async () => {
      const file = makeMulterFile({ originalname: 'photo.jpg' });
      await service.uploadFile({ containerName: 'media', file, blobName: 'avatar' });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/^avatar_[a-f0-9]{32}\.jpg$/);
    });

    it('maneja nombres de archivo compuestos correctamente (photo.wedding.jpg)', async () => {
      const file = makeMulterFile({ originalname: 'photo.wedding.jpg' });
      await service.uploadFile({ containerName: 'media', file });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/^photo\.wedding_[a-f0-9]{32}\.jpg$/);
    });

    it('maneja archivos sin extensión', async () => {
      const file = makeMulterFile({ originalname: 'Makefile', mimetype: 'text/plain' });
      await service.uploadFile({ containerName: 'media', file });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/^makefile_[a-f0-9]{32}$/);
      expect(blobName).not.toContain('.');
    });

    it('aplica folder al blobName generado', async () => {
      const file = makeMulterFile({ originalname: 'photo.jpg' });
      await service.uploadFile({ containerName: 'media', file, folder: 'avatars' });

      const blobName = mockContainerClient.getBlockBlobClient.mock.calls[0][0] as string;
      expect(blobName).toMatch(/^avatars\/photo_[a-f0-9]{32}\.jpg$/);
    });

    it('retorna url y blobName', async () => {
      const file = makeMulterFile();
      const result = await service.uploadFile({ containerName: 'media', file });

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('blobName');
    });
  });

  // ─── deleteBlob ────────────────────────────────────────────────────────────

  describe('deleteBlob()', () => {
    it('llama containerClient.deleteBlob con el nombre correcto', async () => {
      await service.deleteBlob('uploads', 'avatars/foto.jpg');

      expect(mockStorageClient.getContainerClient).toHaveBeenCalledWith('uploads');
      expect(mockContainerClient.deleteBlob).toHaveBeenCalledWith('avatars/foto.jpg');
    });
  });

  // ─── blobExists ────────────────────────────────────────────────────────────

  describe('blobExists()', () => {
    it('retorna true cuando el blob existe', async () => {
      mockBlockBlobClient.exists.mockResolvedValue(true);

      const result = await service.blobExists('uploads', 'foto.jpg');

      expect(result).toBe(true);
    });

    it('retorna false cuando el blob no existe', async () => {
      mockBlockBlobClient.exists.mockResolvedValue(false);

      const result = await service.blobExists('uploads', 'no-existe.jpg');

      expect(result).toBe(false);
    });

    it('consulta el container y blob correctos', async () => {
      await service.blobExists('my-container', 'folder/file.png');

      expect(mockStorageClient.getContainerClient).toHaveBeenCalledWith('my-container');
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('folder/file.png');
    });
  });

  // ─── downloadToBuffer ──────────────────────────────────────────────────────

  describe('downloadToBuffer()', () => {
    it('retorna el contenido del blob como Buffer', async () => {
      const expected = Buffer.from('file content');
      mockBlockBlobClient.downloadToBuffer.mockResolvedValue(expected);

      const result = await service.downloadToBuffer('uploads', 'doc.pdf');

      expect(result).toBe(expected);
    });

    it('consulta el container y blob correctos', async () => {
      await service.downloadToBuffer('reports', 'monthly/report.pdf');

      expect(mockStorageClient.getContainerClient).toHaveBeenCalledWith('reports');
      expect(mockContainerClient.getBlockBlobClient).toHaveBeenCalledWith('monthly/report.pdf');
    });
  });

  // ─── generateSasUrl ────────────────────────────────────────────────────────

  describe('generateSasUrl()', () => {
    it('retorna la URL SAS generada', async () => {
      const result = await service.generateSasUrl('uploads', 'foto.jpg', 15);

      expect(result).toBe('https://sas-url');
    });

    it('calcula expiresOn correctamente según los minutos', async () => {
      const before = Date.now();
      await service.generateSasUrl('uploads', 'foto.jpg', 30);
      const after = Date.now();

      const call = mockBlockBlobClient.generateSasUrl.mock.calls[0][0];
      const expiresOn: Date = call.expiresOn;

      expect(expiresOn.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000);
      expect(expiresOn.getTime()).toBeLessThanOrEqual(after + 30 * 60_000);
    });

    it('solicita permisos de solo lectura', async () => {
      await service.generateSasUrl('uploads', 'foto.jpg', 10);

      const call = mockBlockBlobClient.generateSasUrl.mock.calls[0][0];
      expect(call.permissions.toString()).toBe('r');
    });
  });

  // ─── listBlobs ─────────────────────────────────────────────────────────────

  describe('listBlobs()', () => {
    it('retorna los nombres de todos los blobs del container', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValue(
        (async function* () {
          yield { name: 'file1.jpg' };
          yield { name: 'file2.png' };
        })(),
      );

      const result = await service.listBlobs('uploads');

      expect(result).toEqual(['file1.jpg', 'file2.png']);
    });

    it('pasa el prefix al listar', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValue((async function* () {})());

      await service.listBlobs('uploads', 'avatars/');

      expect(mockContainerClient.listBlobsFlat).toHaveBeenCalledWith({ prefix: 'avatars/' });
    });

    it('retorna array vacío si no hay blobs', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValue((async function* () {})());

      const result = await service.listBlobs('empty-container');

      expect(result).toEqual([]);
    });

    it('llama al container correcto', async () => {
      mockContainerClient.listBlobsFlat.mockReturnValue((async function* () {})());

      await service.listBlobs('my-container');

      expect(mockStorageClient.getContainerClient).toHaveBeenCalledWith('my-container');
    });
  });
});
