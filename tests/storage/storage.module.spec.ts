const mockBlobServiceClient = jest.fn();
const mockFromConnectionString = jest.fn();
const mockSharedKeyCredential = jest.fn();
const mockDefaultAzureCredential = jest.fn();

jest.mock('@azure/storage-blob', () => {
  const ctor: any = jest.fn((...args: unknown[]) => mockBlobServiceClient(...args));
  ctor.fromConnectionString = (...args: unknown[]) => mockFromConnectionString(...args);
  return {
    BlobServiceClient: ctor,
    StorageSharedKeyCredential: jest.fn((...args: unknown[]) => mockSharedKeyCredential(...args)),
  };
});

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: mockDefaultAzureCredential,
}));

import { createBlobServiceClient } from '../../lib/storage/storage.module';

describe('createBlobServiceClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses connection string when provided', () => {
    createBlobServiceClient({ connectionString: 'DefaultEndpointsProtocol=https;AccountName=acc' });

    expect(mockFromConnectionString).toHaveBeenCalledWith(
      'DefaultEndpointsProtocol=https;AccountName=acc',
    );
    expect(mockBlobServiceClient).not.toHaveBeenCalled();
  });

  it('uses shared key auth when account name + key are provided', () => {
    createBlobServiceClient({ storageAccountName: 'acc', storageAccountKey: 'key==' });

    expect(mockSharedKeyCredential).toHaveBeenCalledWith('acc', 'key==');
    expect(mockBlobServiceClient).toHaveBeenCalledWith(
      'https://acc.blob.core.windows.net',
      expect.anything(),
    );
    expect(mockDefaultAzureCredential).not.toHaveBeenCalled();
  });

  it('uses Entra ID (DefaultAzureCredential) when only account name is provided', () => {
    const credentialInstance = {};
    mockDefaultAzureCredential.mockImplementation(() => credentialInstance);

    createBlobServiceClient({ storageAccountName: 'acc' });

    expect(mockDefaultAzureCredential).toHaveBeenCalledTimes(1);
    expect(mockSharedKeyCredential).not.toHaveBeenCalled();
    expect(mockBlobServiceClient).toHaveBeenCalledWith(
      'https://acc.blob.core.windows.net',
      credentialInstance,
    );
  });

  it('uses the provided credential instead of DefaultAzureCredential when given', () => {
    const customCredential = { getToken: jest.fn() } as any;

    createBlobServiceClient({ storageAccountName: 'acc', credential: customCredential });

    expect(mockDefaultAzureCredential).not.toHaveBeenCalled();
    expect(mockBlobServiceClient).toHaveBeenCalledWith(
      'https://acc.blob.core.windows.net',
      customCredential,
    );
  });
});
