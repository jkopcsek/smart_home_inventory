import { HaMode } from '../enums';

export interface SyncCounts {
  created: number;
  updated: number;
  orphaned: number;
  unchanged: number;
}

export interface SyncResultDto {
  floors: SyncCounts;
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

/** Capability keys inferred from a device's HA entity registry (platform +
 *  device_class) — see HaCapabilitySuggestionsService. Purely informational. */
export interface HaCapabilitySuggestionDto {
  suggestedCapabilities: Array<{ key: string; label: string }>;
}
