import { HaMode } from '../enums';

export interface SyncCounts {
  created: number;
  updated: number;
  orphaned: number;
  unchanged: number;
}

export interface SyncResultDto {
  areas: SyncCounts;
  devices: SyncCounts;
  warnings: string[];
  syncedAt: string;
}

export interface HaStatusDto {
  mode: HaMode;
  connected: boolean;
  /** When true (the default), the app never sends write commands to HA. */
  readOnly: boolean;
  lastSyncAt: string | null;
  lastSyncResult: SyncResultDto | null;
}
