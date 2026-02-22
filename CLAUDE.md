# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is **@lightsoft-pe/nest-kit**, a shared NestJS utility library providing reusable modules for Lightsoft's NestJS projects. It integrates with Azure services (Application Insights, Blob Storage) and exports common helpers and error infrastructure.

## Commands

```bash
npm run build        # Compiles TypeScript to dist/
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
```

Tests live in `tests/` (excluded from the build tsconfig). A separate `tsconfig.test.json` is used by Jest via `ts-jest`.

## Architecture

Source lives in [lib/](lib/) (not `src/`). The [lib/index.ts](lib/index.ts) is the main barrel export.

### Modules

Both modules are `@Global()` and support both `forRoot()` and `forRootAsync()`. The async variant accepts `{ imports, inject, useFactory }` to integrate with `ConfigService`.

Injection tokens are exported Symbols (never plain strings):
- `LOGGER_CLIENT`, `LOGGER_MODULE_OPTIONS` — from [lib/logger/logger.constants.ts](lib/logger/logger.constants.ts)
- `STORAGE_CLIENT`, `STORAGE_MODULE_OPTIONS` — from [lib/storage/storage.constants.ts](lib/storage/storage.constants.ts)

**[LoggerModule](lib/logger/logger.module.ts)** — wraps Azure Application Insights. `LoggerService` extends `ConsoleLogger` with `Scope.TRANSIENT`. Uses `AsyncLocalStorage` for request context propagation (no `@Inject(REQUEST)` — avoids scope cascade and works in non-HTTP contexts). Call `LoggerService.setRequestContext(ctx, callback)` from a middleware or interceptor.

**[StorageModule](lib/storage/storage.module.ts)** — wraps Azure Blob Storage. `StorageService` auto-generates unique blob names when none is provided.

### Errors

[lib/errors/](lib/errors/) provides infrastructure, not domain codes:
- `AppException` — base class extending `HttpException`, accepts `{ code, message }` + optional `HttpStatus`
- `HttpExceptionFilter` — generic `@Catch(HttpException)` filter that adds `statusCode` and `timestamp`

### Helpers

Located in [lib/helpers/](lib/helpers/):
- `StringsHelper` — `capitalizeFirstLetter`, `toLowerSnakeCase`
- `MapperHelper` — `cleanCosmosDocument` removes Azure Cosmos DB `_`-prefixed system properties
- `AsyncHelper` — `wait(ms)` promise-based delay

## Build Output

TypeScript compiles to `dist/` (CommonJS, ES2022 target, with `.d.ts` declarations and source maps). The `tsconfig.json` only includes `lib/**/*`.

## Publishing

Published to npm as a public package. Only `dist/` is included (via `"files": ["dist"]`). Azure SDKs (`@azure/storage-blob`, `applicationinsights`) are optional `peerDependencies`.
