# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is **@lightsoft-pe/nest-kit**, a shared NestJS utility library providing reusable modules for Lightsoft's NestJS projects. It integrates with Azure services (Application Insights, Blob Storage) and exports common helpers and error constants.

## Commands

```bash
# Build (compiles TypeScript to dist/)
npm run build

# Build runs automatically on install/publish
npm run prepare
```

There are no test or lint scripts configured — only `build` and `prepare`.

## Architecture

Source lives in [lib/](lib/) (not `src/`). The [lib/index.ts](lib/index.ts) is the main barrel export.

### Modules

Both modules follow the **`forRoot()` dynamic module pattern** and are globally scoped:

- **[LoggerModule](lib/logger/logger.module.ts)** — wraps Azure Application Insights. Requires `appInsightConnectionString`. Exports `LoggerService`, which extends NestJS `ConsoleLogger` and has transient scope (new instance per injection). Tracks traces/exceptions to App Insights with severity mapping.

- **[StorageModule](lib/storage/storage.module.ts)** — wraps Azure Blob Storage. Requires `storageAccountName` and `storageAccountKey`. Provides a `StorageClient` (BlobServiceClient) token internally. `StorageService` uses `StringsHelper` to auto-generate lowercase snake_case blob names with a random suffix.

### Helpers

Located in [lib/helpers/](lib/helpers/):
- `StringsHelper` — `capitalizeFirstLetter`, `toLowerSnakeCase`
- `MapperHelper` — `cleanCosmosDocument` removes Azure Cosmos DB `_`-prefixed system properties
- `AsyncHelper` — `wait(ms)` promise-based delay

### Error Constants

[lib/errors/app-errors.contants.ts](lib/errors/app-errors.contants.ts) exports `ERROR_CODES` enum and `ERRORS` object with code/message pairs.

## Build Output

TypeScript compiles to `dist/` (CommonJS, ES2022 target, with `.d.ts` declarations and source maps). The `tsconfig.json` only includes `lib/**/*` — the `sample/` directory is excluded from compilation.

## Publishing

Published to npm as a public package. Only `dist/` is included in the published package (via `"files": ["dist"]` in package.json).
