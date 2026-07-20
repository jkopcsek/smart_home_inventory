import { HaArea, HaDevice } from './ha-registry.types';

/** The slice of local state the merge needs — kept minimal for testability. */
export interface LocalArea {
  id: string;
  name: string;
  haAreaId: string | null;
  haName: string | null;
  haOrphaned: boolean;
}

export interface LocalDevice {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  areaId: string | null;
  haDeviceId: string | null;
  haName: string | null;
  haAreaIdAtSync: string | null;
  haOrphaned: boolean;
}

export interface AreaCreateOp {
  haAreaId: string;
  name: string;
}

export interface AreaUpdateOp {
  id: string;
  data: Partial<{ name: string; haName: string; haOrphaned: boolean }>;
}

export interface DeviceCreateOp {
  haDeviceId: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  /** HA area id — resolved to a local area id by the sync service. */
  haAreaRef: string | null;
}

export interface DeviceUpdateOp {
  id: string;
  data: Partial<{
    name: string;
    manufacturer: string;
    model: string;
    haName: string;
    haAreaIdAtSync: string | null;
    haOrphaned: boolean;
  }>;
  /** When set, the sync service re-links the device's area: HA area id or null. */
  haAreaRef?: string | null;
}

export interface MergeResult {
  areaCreates: AreaCreateOp[];
  areaUpdates: AreaUpdateOp[];
  deviceCreates: DeviceCreateOp[];
  deviceUpdates: DeviceUpdateOp[];
  warnings: string[];
}

function effectiveName(device: HaDevice): string {
  return device.name_by_user ?? device.name ?? '(unnamed device)';
}

/**
 * Pure merge of the HA registry into local state.
 *
 * Rules:
 * - Entities are matched by haAreaId / haDeviceId.
 * - Names follow HA until the user renames locally (detected by comparing the
 *   local name against the last-synced HA name).
 * - manufacturer/model are only filled when empty locally, never overwritten.
 * - Devices follow HA area moves until the user manually reassigns them.
 * - Entities that disappeared from HA are flagged orphaned, never deleted.
 * - Purely local entities (no ha id) are untouched.
 */
export function mergeRegistry(
  local: { areas: LocalArea[]; devices: LocalDevice[] },
  remote: { areas: HaArea[]; devices: HaDevice[] }
): MergeResult {
  const result: MergeResult = {
    areaCreates: [],
    areaUpdates: [],
    deviceCreates: [],
    deviceUpdates: [],
    warnings: [],
  };

  const localAreasByHaId = new Map(
    local.areas.filter((a) => a.haAreaId).map((a) => [a.haAreaId as string, a])
  );
  const localAreasById = new Map(local.areas.map((a) => [a.id, a]));
  const remoteAreaIds = new Set(remote.areas.map((a) => a.area_id));

  for (const remoteArea of remote.areas) {
    const localArea = localAreasByHaId.get(remoteArea.area_id);
    if (!localArea) {
      result.areaCreates.push({ haAreaId: remoteArea.area_id, name: remoteArea.name });
      continue;
    }
    const data: AreaUpdateOp['data'] = {};
    const userRenamed = localArea.haName !== null && localArea.name !== localArea.haName;
    if (!userRenamed && localArea.name !== remoteArea.name) {
      data.name = remoteArea.name;
    }
    if (localArea.haName !== remoteArea.name) data.haName = remoteArea.name;
    if (localArea.haOrphaned) data.haOrphaned = false;
    if (Object.keys(data).length > 0) {
      result.areaUpdates.push({ id: localArea.id, data });
    }
  }

  for (const localArea of local.areas) {
    if (localArea.haAreaId && !remoteAreaIds.has(localArea.haAreaId) && !localArea.haOrphaned) {
      result.areaUpdates.push({ id: localArea.id, data: { haOrphaned: true } });
    }
  }

  const localDevicesByHaId = new Map(
    local.devices.filter((d) => d.haDeviceId).map((d) => [d.haDeviceId as string, d])
  );
  const remoteDevices = remote.devices.filter((d) => d.entry_type !== 'service');
  const remoteDeviceIds = new Set(remoteDevices.map((d) => d.id));

  for (const remoteDevice of remoteDevices) {
    const name = effectiveName(remoteDevice);
    const localDevice = localDevicesByHaId.get(remoteDevice.id);
    if (!localDevice) {
      result.deviceCreates.push({
        haDeviceId: remoteDevice.id,
        name,
        manufacturer: remoteDevice.manufacturer,
        model: remoteDevice.model,
        haAreaRef: remoteDevice.area_id,
      });
      continue;
    }

    const op: DeviceUpdateOp = { id: localDevice.id, data: {} };
    const userRenamed =
      localDevice.haName !== null && localDevice.name !== localDevice.haName;
    if (!userRenamed && localDevice.name !== name) op.data.name = name;
    if (localDevice.haName !== name) op.data.haName = name;
    if (!localDevice.manufacturer && remoteDevice.manufacturer) {
      op.data.manufacturer = remoteDevice.manufacturer;
    }
    if (!localDevice.model && remoteDevice.model) op.data.model = remoteDevice.model;
    if (localDevice.haOrphaned) op.data.haOrphaned = false;

    // Area follow rule: the user "took over" placement iff the device's
    // current local area is not the one the last sync assigned.
    const currentAreaHaId = localDevice.areaId
      ? localAreasById.get(localDevice.areaId)?.haAreaId ?? null
      : null;
    const userMoved = currentAreaHaId !== localDevice.haAreaIdAtSync;
    if (remoteDevice.area_id !== localDevice.haAreaIdAtSync) {
      op.data.haAreaIdAtSync = remoteDevice.area_id;
      if (!userMoved) {
        op.haAreaRef = remoteDevice.area_id;
      }
    }

    if (Object.keys(op.data).length > 0 || op.haAreaRef !== undefined) {
      result.deviceUpdates.push(op);
    }
  }

  for (const localDevice of local.devices) {
    if (
      localDevice.haDeviceId &&
      !remoteDeviceIds.has(localDevice.haDeviceId) &&
      !localDevice.haOrphaned
    ) {
      result.deviceUpdates.push({ id: localDevice.id, data: { haOrphaned: true } });
    }
  }

  return result;
}
