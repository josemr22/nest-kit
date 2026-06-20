const mockServiceBusClient = jest.fn();
const mockDefaultAzureCredential = jest.fn();

jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: mockServiceBusClient,
}));

jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: mockDefaultAzureCredential,
}));

import { createServiceBusClient } from '../../lib/service-bus/service-bus.module';

describe('createServiceBusClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Entra ID (namespace + DefaultAzureCredential) when fullyQualifiedNamespace is set', () => {
    const credentialInstance = {};
    mockDefaultAzureCredential.mockImplementation(() => credentialInstance);

    createServiceBusClient({
      fullyQualifiedNamespace: 'ns.servicebus.windows.net',
    });

    expect(mockDefaultAzureCredential).toHaveBeenCalledTimes(1);
    expect(mockServiceBusClient).toHaveBeenCalledWith(
      'ns.servicebus.windows.net',
      credentialInstance,
    );
  });

  it('uses the provided credential instead of DefaultAzureCredential when given', () => {
    const customCredential = { getToken: jest.fn() } as any;

    createServiceBusClient({
      fullyQualifiedNamespace: 'ns.servicebus.windows.net',
      credential: customCredential,
    });

    expect(mockDefaultAzureCredential).not.toHaveBeenCalled();
    expect(mockServiceBusClient).toHaveBeenCalledWith(
      'ns.servicebus.windows.net',
      customCredential,
    );
  });

  it('prefers namespace over connectionString when both are present', () => {
    createServiceBusClient({
      fullyQualifiedNamespace: 'ns.servicebus.windows.net',
      connectionString: 'Endpoint=sb://ns/;SharedAccessKey=key',
    });

    expect(mockServiceBusClient).toHaveBeenCalledWith(
      'ns.servicebus.windows.net',
      expect.anything(),
    );
  });

  it('falls back to connection string (SAS) when no namespace is set', () => {
    createServiceBusClient({
      connectionString: 'Endpoint=sb://ns/;SharedAccessKey=key',
    });

    expect(mockDefaultAzureCredential).not.toHaveBeenCalled();
    expect(mockServiceBusClient).toHaveBeenCalledWith(
      'Endpoint=sb://ns/;SharedAccessKey=key',
    );
  });

  it('throws when neither namespace nor connectionString is provided', () => {
    expect(() => createServiceBusClient({})).toThrow(
      /fullyQualifiedNamespace.*connectionString/,
    );
  });
});
