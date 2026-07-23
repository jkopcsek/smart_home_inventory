import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { HaArea, HaDevice, HaFloor, HaRegistryClient } from './ha-registry.types';

interface HaWsResultMessage {
  id: number;
  type: 'result';
  success: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

/**
 * Commands that only read state from Home Assistant. In read-only mode
 * (the default) anything not on this list is refused at the transport layer —
 * a future write feature cannot bypass the toggle by accident.
 */
const READ_ONLY_COMMANDS = new Set([
  'config/area_registry/list',
  'config/device_registry/list',
  'config/floor_registry/list',
  'config/entity_registry/list',
  'get_config',
  'get_states',
  'ping',
]);

export function assertCommandAllowed(type: string, readOnly: boolean): void {
  if (readOnly && !READ_ONLY_COMMANDS.has(type)) {
    throw new Error(
      `HA command "${type}" blocked: the connection is in read-only mode ` +
        `(set HA_READ_ONLY=false or the add-on's read_only option to allow writes)`
    );
  }
}

/**
 * Minimal Home Assistant WebSocket API client. Connects per call burst and
 * closes again — a sync is 2–3 commands, so no persistent connection or
 * reconnect logic is needed.
 */
export class WsHaRegistryClient implements HaRegistryClient {
  private readonly logger = new Logger(WsHaRegistryClient.name);

  constructor(
    private readonly wsUrl: string,
    private readonly token: string,
    private readonly readOnly = true,
    private readonly timeoutMs = 10000
  ) {}

  async listAreas(): Promise<HaArea[]> {
    const result = await this.command('config/area_registry/list');
    return (result as HaArea[]).map((a) => ({
      area_id: a.area_id,
      name: a.name,
      floor_id: a.floor_id ?? null,
    }));
  }

  async listFloors(): Promise<HaFloor[]> {
    const result = await this.command('config/floor_registry/list');
    return (result as HaFloor[]).map((f) => ({
      floor_id: f.floor_id,
      name: f.name,
      level: f.level ?? null,
    }));
  }

  async listDevices(): Promise<HaDevice[]> {
    const result = await this.command('config/device_registry/list');
    return (result as HaDevice[]).map((d) => ({
      id: d.id,
      name: d.name ?? null,
      name_by_user: d.name_by_user ?? null,
      manufacturer: d.manufacturer ?? null,
      model: d.model ?? null,
      area_id: d.area_id ?? null,
      entry_type: d.entry_type ?? null,
    }));
  }

  async ping(): Promise<boolean> {
    try {
      await this.command('config/area_registry/list');
      return true;
    } catch {
      return false;
    }
  }

  private command(type: string): Promise<unknown> {
    assertCommandAllowed(type, this.readOnly);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`HA WebSocket timeout after ${this.timeoutMs}ms (${type})`));
      }, this.timeoutMs);
      const done = (fn: () => void) => {
        clearTimeout(timer);
        try {
          ws.close();
        } catch {
          // ignore
        }
        fn();
      };

      ws.on('error', (err) => done(() => reject(err)));
      ws.on('message', (raw) => {
        let msg: { type: string };
        try {
          msg = JSON.parse(raw.toString());
        } catch (err) {
          return done(() => reject(new Error(`Invalid HA WS message: ${err}`)));
        }
        switch (msg.type) {
          case 'auth_required':
            ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
            break;
          case 'auth_ok':
            ws.send(JSON.stringify({ id: 1, type }));
            break;
          case 'auth_invalid':
            done(() => reject(new Error('HA WebSocket authentication failed')));
            break;
          case 'result': {
            const result = msg as unknown as HaWsResultMessage;
            if (result.success) {
              done(() => resolve(result.result));
            } else {
              done(() =>
                reject(
                  new Error(
                    `HA command "${type}" failed: ${result.error?.message ?? 'unknown'}`
                  )
                )
              );
            }
            break;
          }
          default:
            // ignore events/pongs
            break;
        }
      });
    });
  }
}
