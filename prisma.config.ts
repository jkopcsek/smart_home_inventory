import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (generate / migrate). The runtime backend does NOT
 * read this — it builds its own adapter from DATA_DIR (see PrismaService).
 * Both derive the DB location the same way: ${DATA_DIR:-./data}/inventory.db.
 */
const dataDir = path.resolve(process.env['DATA_DIR'] ?? './data');

export default defineConfig({
  schema: 'libs/prisma/prisma/schema.prisma',
  migrations: {
    path: 'libs/prisma/prisma/migrations',
  },
  datasource: {
    url: `file:${path.join(dataDir, 'inventory.db')}`,
  },
});
