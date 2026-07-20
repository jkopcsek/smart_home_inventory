# prisma

Owns everything database-related:

- `prisma/schema.prisma` — the data model (Prisma 7, SQLite)
- `prisma/migrations/` — migration history, applied with `prisma migrate deploy` at add-on startup
- `src/generated/` — the **checked-in** TypeScript client (`prisma-client` generator, no engine binary). Do not edit; regenerate with `npm run prisma:generate` after schema changes.

Import via `@smart-home-inventory/prisma`. The CLI is configured by `prisma.config.ts` at the repo root; the runtime connects through `@prisma/adapter-better-sqlite3` (see `PrismaService` in the backend).
