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

/** Subset of HA's entity registry entries we care about. `platform` is the
 *  integration handling the entity (zha, mqtt, matter, zwave_js, esphome,
 *  ...) — a far more reliable protocol signal than trying to match a
 *  manufacturer/model string against an external database, since it's what
 *  HA itself determined when the device was actually paired. */
export interface HaEntity {
  entity_id: string;
  device_id: string | null;
  platform: string;
  device_class: string | null;
}

export interface HaRegistryClient {
  listAreas(): Promise<HaArea[]>;
  listDevices(): Promise<HaDevice[]>;
  listFloors(): Promise<HaFloor[]>;
  listEntities(): Promise<HaEntity[]>;
  ping(): Promise<boolean>;
}

export const HA_REGISTRY_CLIENT = Symbol('HA_REGISTRY_CLIENT');
