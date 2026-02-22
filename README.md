# @lightsoft-pe/nest-kit

Shared NestJS utility library for Lightsoft projects. Provides plug-and-play modules for Azure Application Insights, Azure Blob Storage, and Azure Service Bus, plus common helpers.

## Installation

```bash
npm install @lightsoft-pe/nest-kit
```

Install only the Azure peer dependencies you actually use:

```bash
npm install applicationinsights          # LoggerModule
npm install @azure/storage-blob          # StorageModule
npm install @azure/service-bus           # ServiceBusModule
```

---

## LoggerModule

Wraps Azure Application Insights. `LoggerService` extends NestJS's `ConsoleLogger` — it logs to the console **and** sends telemetry to Application Insights simultaneously.

### Setup

```ts
// app.module.ts
import { LoggerModule } from '@lightsoft-pe/nest-kit';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appInsightConnectionString: config.get('APPLICATIONINSIGHTS_CONNECTION_STRING'),
      }),
    }),
  ],
})
export class AppModule {}
```

### Request context (middleware)

Propagates request metadata to every log call within the same async scope — no need to pass it manually on every call.

```ts
// logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { LoggerService } from '@lightsoft-pe/nest-kit';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    LoggerService.setRequestContext(
      {
        requestId: req.headers['x-request-id'] as string,
        userId: (req as any).user?.id,
        method: req.method,
        url: req.url,
      },
      next,
    );
  }
}
```

### Usage in a service

```ts
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@lightsoft-pe/nest-kit';

@Injectable()
export class UsersService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext(UsersService.name);
  }

  async findById(id: string) {
    this.logger.log('Fetching user', { userId: id });

    try {
      const user = await this.repo.findById(id);
      return user;
    } catch (err) {
      this.logger.error(err, { userId: id });
      throw err;
    }
  }

  async trackPurchase(userId: string, amount: number) {
    // Custom Application Insights event
    this.logger.trackEvent('PurchaseCompleted', { userId }, { amount });

    // Custom metric
    this.logger.trackMetric('PurchaseAmount', amount);

    // Dependency tracking
    this.logger.trackDependency('PaymentGateway', 320, true, 200, 'HTTP', 'POST /charge');
  }
}
```

---

## StorageModule

Wraps Azure Blob Storage. Supports connection string or account name + key.

### Setup

```ts
// app.module.ts
import { StorageModule } from '@lightsoft-pe/nest-kit';

@Module({
  imports: [
    StorageModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connectionString: config.get('AZURE_STORAGE_CONNECTION_STRING'),
        // or: { storageAccountName: '...', storageAccountKey: '...' }
      }),
    }),
  ],
})
export class AppModule {}
```

### Usage

```ts
import { Injectable } from '@nestjs/common';
import { StorageService } from '@lightsoft-pe/nest-kit';

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  // Upload a Multer file (e.g. from a @UploadedFile() decorator)
  async uploadAvatar(file: Express.Multer.File, userId: string) {
    const { url, blobName } = await this.storage.uploadFile({
      file,
      containerName: 'media',
      folder: 'avatars',
      blobName: `user_${userId}`,
    });
    // blobName → 'avatars/user_123_a1b2c3d4....jpg'
    // Store blobName in DB to delete it later
    return url;
  }

  // Upload a buffer (e.g. a generated PDF)
  async uploadReport(pdf: Buffer) {
    return this.storage.uploadBuffer({
      containerName: 'reports',
      buffer: pdf,
      contentType: 'application/pdf',
      folder: 'monthly',
    });
  }

  // Replace an existing file
  async replaceAvatar(oldBlobName: string, file: Express.Multer.File) {
    if (await this.storage.blobExists('media', oldBlobName)) {
      await this.storage.deleteBlob('media', oldBlobName);
    }
    return this.storage.uploadFile({ file, containerName: 'media', folder: 'avatars' });
  }

  // Temporary download URL for a private container (15 minutes)
  async getDownloadUrl(blobName: string) {
    return this.storage.generateSasUrl('reports', blobName, 15);
  }

  // List all files in a virtual folder
  async listAvatars() {
    return this.storage.listBlobs('media', 'avatars/');
  }
}
```

---

## ServiceBusModule

Wraps Azure Service Bus as a **message producer**. Senders are cached per queue/topic and closed gracefully on module destroy.

### Setup

```ts
// app.module.ts
import { ServiceBusModule } from '@lightsoft-pe/nest-kit';

@Module({
  imports: [
    ServiceBusModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connectionString: config.get('SERVICE_BUS_CONNECTION_STRING'),
      }),
    }),
  ],
})
export class AppModule {}
```

### Usage

```ts
import { Injectable } from '@nestjs/common';
import { ServiceBusService } from '@lightsoft-pe/nest-kit';

@Injectable()
export class OrdersService {
  constructor(private readonly sb: ServiceBusService) {}

  // Send a single message
  async placeOrder(order: Order) {
    await this.sb.send('orders-queue', order, {
      messageId: order.id,           // idempotency
      correlationId: order.requestId, // tracing
    });
  }

  // Send multiple messages efficiently
  async importOrders(orders: Order[]) {
    await this.sb.sendBatch('orders-queue', orders);
  }

  // Schedule a reminder for 24 hours from now
  async scheduleReminder(userId: string) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [seqNum] = await this.sb.schedule('reminders-queue', { userId }, tomorrow);
    return seqNum; // store in DB to cancel later
  }

  // Cancel a scheduled message
  async cancelReminder(sequenceNumber: bigint) {
    await this.sb.cancelScheduled('reminders-queue', sequenceNumber);
  }
}
```

---

## Helpers

Standalone utility functions, no dependencies.

```ts
import { capitalize, toLowerSnakeCase, sleep, stripCosmosFields } from '@lightsoft-pe/nest-kit';

capitalize('hello');            // → 'Hello'
toLowerSnakeCase('myFileName'); // → 'my_file_name'
toLowerSnakeCase('My Photo');   // → 'my_photo'

await sleep(500); // pause 500ms

// Remove Cosmos DB system fields (_rid, _self, _etag, _ts, _attachments)
const clean = stripCosmosFields(cosmosDoc);

// Also remove specific extra fields
const clean = stripCosmosFields(cosmosDoc, ['ttl', 'partitionKey']);
```
