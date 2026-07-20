/* eslint-disable */
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { waitForPortOpen } from '@nx/node/utils';

/**
 * Boots the real built backend against a fresh temp DATA_DIR:
 * migrations run via `prisma migrate deploy` (also exercising the production
 * startup path), then the server starts in mock-HA mode.
 */
module.exports = async function () {
  const workspaceRoot = join(__dirname, '../../../..');
  const dataDir = mkdtempSync(join(tmpdir(), 'shi-e2e-'));
  const port = Number(process.env.PORT ?? 8199);

  console.log(`\n[e2e] DATA_DIR=${dataDir}`);
  execSync('npx nx build backend', { cwd: workspaceRoot, stdio: 'inherit' });
  execSync('npx prisma migrate deploy', {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: { ...process.env, DATA_DIR: dataDir },
  });

  const server: ChildProcess = spawn(
    'node',
    ['dist/apps/backend/main.js'],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        PORT: String(port),
        HA_MOCK: 'true',
      },
      stdio: 'inherit',
    }
  );

  await waitForPortOpen(port, { host: 'localhost' });
  (globalThis as any).__SERVER__ = server;
};
