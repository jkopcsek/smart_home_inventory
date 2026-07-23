/** Subset of HA's area registry entries we care about. */
export interface HaArea {
  area_id: string;
  name: string;
  floor_id: string | null;
}

/** Subset of HA's device registry entries we care about. */
export interface HaDevice {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
  entry_type: string | null;
}

/** Subset of HA's floor registry entries we care about. */
export interface HaFloor {
  floor_id: string;
  name: string;
  level: number | null;
}

export interface HaRegistryClient {
  listAreas(): Promise<HaArea[]>;
  listDevices(): Promise<HaDevice[]>;
  listFloors(): Promise<HaFloor[]>;
  ping(): Promise<boolean>;
}

export const HA_REGISTRY_CLIENT = Symbol('HA_REGISTRY_CLIENT');
