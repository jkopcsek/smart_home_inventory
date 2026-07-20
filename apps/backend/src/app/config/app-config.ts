import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { HaMode } from '@smart-home-inventory/shared';

const flag = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8099),
  DATA_DIR: z.string().default('/data'),
  STATIC_DIR: z.string().optional(),
  SUPERVISOR_TOKEN: z.string().optional(),
  HA_URL: z.string().optional(),
  HA_TOKEN: z.string().optional(),
  HA_MOCK: flag,
  HA_READ_ONLY: z.string().optional(),
  HA_SYNC_INTERVAL_MINUTES: z.coerce.number().int().nonnegative().default(0),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
});

/**
 * Read-only guard for the Home Assistant connection. Defaults to true — the
 * app never writes to HA unless the user explicitly opts out. Resolution
 * order: HA_READ_ONLY env var → add-on option (`read_only` in
 * ${DATA_DIR}/options.json, written by the Supervisor) → true.
 */
function resolveHaReadOnly(envValue: string | undefined, dataDir: string): boolean {
  if (envValue !== undefined) {
    return !(envValue === 'false' || envValue === '0');
  }
  try {
    const options = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'options.json'), 'utf8')
    );
    if (typeof options.read_only === 'boolean') return options.read_only;
  } catch {
    // no options.json (dev mode) — fall through to the safe default
  }
  return true;
}

export class AppConfig {
  readonly port: number;
  readonly dataDir: string;
  readonly uploadsDir: string;
  readonly databaseUrl: string;
  readonly staticDir: string | undefined;
  readonly supervisorToken: string | undefined;
  readonly haUrl: string | undefined;
  readonly haToken: string | undefined;
  readonly haMock: boolean;
  readonly haReadOnly: boolean;
  readonly haSyncIntervalMinutes: number;
  readonly uploadMaxBytes: number;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const parsed = EnvSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${parsed.error.message}`);
    }
    const e = parsed.data;
    this.port = e.PORT;
    this.dataDir = path.resolve(e.DATA_DIR);
    this.uploadsDir = path.join(this.dataDir, 'uploads');
    // The runtime DB location is controlled exclusively by DATA_DIR; the
    // DATABASE_URL env var is only for the Prisma CLI (schema-relative path).
    this.databaseUrl = `file:${path.join(this.dataDir, 'inventory.db')}`;
    this.staticDir = e.STATIC_DIR ? path.resolve(e.STATIC_DIR) : undefined;
    this.supervisorToken = e.SUPERVISOR_TOKEN;
    this.haUrl = e.HA_URL;
    this.haToken = e.HA_TOKEN;
    this.haMock = e.HA_MOCK;
    this.haReadOnly = resolveHaReadOnly(e.HA_READ_ONLY, this.dataDir);
    this.haSyncIntervalMinutes = e.HA_SYNC_INTERVAL_MINUTES;
    this.uploadMaxBytes = e.UPLOAD_MAX_BYTES;
  }

  get haMode(): HaMode {
    if (this.haMock) return 'mock';
    if (this.supervisorToken) return 'supervisor';
    if (this.haUrl && this.haToken) return 'direct';
    return 'mock';
  }

  ensureDataDirs(): void {
    fs.mkdirSync(this.uploadsDir, { recursive: true });
  }
}
