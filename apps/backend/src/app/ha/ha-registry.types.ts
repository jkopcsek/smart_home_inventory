/** Subset of HA's area registry entries we care about. */
export interface HaArea {
  area_id: string;
  name: string;
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

export interface HaRegistryClient {
  listAreas(): Promise<HaArea[]>;
  listDevices(): Promise<HaDevice[]>;
  ping(): Promise<boolean>;
}

export const HA_REGISTRY_CLIENT = Symbol('HA_REGISTRY_CLIENT');
