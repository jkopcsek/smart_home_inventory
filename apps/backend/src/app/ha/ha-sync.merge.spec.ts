import { LocalArea, LocalDevice, mergeRegistry } from './ha-sync.merge';
import { HaArea, HaDevice } from './ha-registry.types';

const remoteArea = (id: string, name: string): HaArea => ({ area_id: id, name });

const remoteDevice = (overrides: Partial<HaDevice> & { id: string }): HaDevice => ({
  name: null,
  name_by_user: null,
  manufacturer: null,
  model: null,
  area_id: null,
  entry_type: null,
  ...overrides,
});

const localArea = (overrides: Partial<LocalArea> & { id: string }): LocalArea => ({
  name: overrides.id,
  haAreaId: null,
  haName: null,
  haOrphaned: false,
  ...overrides,
});

const localDevice = (overrides: Partial<LocalDevice> & { id: string }): LocalDevice => ({
  name: overrides.id,
  manufacturer: null,
  model: null,
  areaId: null,
  haDeviceId: null,
  haName: null,
  haAreaIdAtSync: null,
  haOrphaned: false,
  ...overrides,
});

describe('mergeRegistry', () => {
  it('creates rooms and devices for new HA entities', () => {
    const result = mergeRegistry(
      { areas: [], devices: [] },
      {
        areas: [remoteArea('wz', 'Wohnzimmer')],
        devices: [
          remoteDevice({
            id: 'd1',
            name: 'Lamp',
            name_by_user: 'Stehlampe',
            manufacturer: 'Signify',
            area_id: 'wz',
          }),
        ],
      }
    );
    expect(result.areaCreates).toEqual([{ haAreaId: 'wz', name: 'Wohnzimmer' }]);
    expect(result.deviceCreates).toEqual([
      {
        haDeviceId: 'd1',
        name: 'Stehlampe',
        manufacturer: 'Signify',
        model: null,
        haAreaRef: 'wz',
      },
    ]);
  });

  it('is idempotent: no ops when local matches remote', () => {
    const result = mergeRegistry(
      {
        areas: [localArea({ id: 'a1', name: 'Wohnzimmer', haAreaId: 'wz', haName: 'Wohnzimmer' })],
        devices: [
          localDevice({
            id: 'x1',
            name: 'Stehlampe',
            haDeviceId: 'd1',
            haName: 'Stehlampe',
            areaId: 'a1',
            haAreaIdAtSync: 'wz',
            manufacturer: 'Signify',
          }),
        ],
      },
      {
        areas: [remoteArea('wz', 'Wohnzimmer')],
        devices: [
          remoteDevice({
            id: 'd1',
            name_by_user: 'Stehlampe',
            manufacturer: 'Signify',
            area_id: 'wz',
          }),
        ],
      }
    );
    expect(result.areaCreates).toHaveLength(0);
    expect(result.areaUpdates).toHaveLength(0);
    expect(result.deviceCreates).toHaveLength(0);
    expect(result.deviceUpdates).toHaveLength(0);
  });

  it('follows HA renames while the user has not renamed locally', () => {
    const result = mergeRegistry(
      {
        areas: [localArea({ id: 'a1', name: 'Wohnzimmer', haAreaId: 'wz', haName: 'Wohnzimmer' })],
        devices: [],
      },
      { areas: [remoteArea('wz', 'Living room')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([
      { id: 'a1', data: { name: 'Living room', haName: 'Living room' } },
    ]);
  });

  it('keeps the local name once the user renamed it', () => {
    const result = mergeRegistry(
      {
        areas: [localArea({ id: 'a1', name: 'Stube', haAreaId: 'wz', haName: 'Wohnzimmer' })],
        devices: [],
      },
      { areas: [remoteArea('wz', 'Living room')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([
      { id: 'a1', data: { haName: 'Living room' } },
    ]);
  });

  it('never overwrites user-entered manufacturer/model', () => {
    const result = mergeRegistry(
      {
        areas: [],
        devices: [
          localDevice({
            id: 'x1',
            name: 'Lamp',
            haDeviceId: 'd1',
            haName: 'Lamp',
            manufacturer: 'MyBrand',
          }),
        ],
      },
      {
        areas: [],
        devices: [
          remoteDevice({ id: 'd1', name: 'Lamp', manufacturer: 'Signify', model: 'LCA001' }),
        ],
      }
    );
    expect(result.deviceUpdates).toEqual([
      { id: 'x1', data: { model: 'LCA001' } },
    ]);
  });

  it('follows HA area moves until the user manually reassigns', () => {
    const areas = [
      localArea({ id: 'a1', haAreaId: 'wz', haName: 'WZ', name: 'WZ' }),
      localArea({ id: 'a2', haAreaId: 'sz', haName: 'SZ', name: 'SZ' }),
    ];
    // Device still where sync put it → follows the HA move.
    const follows = mergeRegistry(
      {
        areas,
        devices: [
          localDevice({
            id: 'x1',
            name: 'Sensor',
            haDeviceId: 'd1',
            haName: 'Sensor',
            areaId: 'a1',
            haAreaIdAtSync: 'wz',
          }),
        ],
      },
      {
        areas: [remoteArea('wz', 'WZ'), remoteArea('sz', 'SZ')],
        devices: [remoteDevice({ id: 'd1', name: 'Sensor', area_id: 'sz' })],
      }
    );
    expect(follows.deviceUpdates).toEqual([
      { id: 'x1', data: { haAreaIdAtSync: 'sz' }, haAreaRef: 'sz' },
    ]);

    // User moved the device to a2 themselves → HA move is NOT applied.
    const userMoved = mergeRegistry(
      {
        areas,
        devices: [
          localDevice({
            id: 'x1',
            name: 'Sensor',
            haDeviceId: 'd1',
            haName: 'Sensor',
            areaId: 'a2',
            haAreaIdAtSync: 'wz',
          }),
        ],
      },
      {
        areas: [remoteArea('wz', 'WZ'), remoteArea('sz', 'SZ')],
        devices: [remoteDevice({ id: 'd1', name: 'Sensor', area_id: 'flur' })],
      }
    );
    expect(userMoved.deviceUpdates).toEqual([
      { id: 'x1', data: { haAreaIdAtSync: 'flur' } },
    ]);
  });

  it('flags disappeared entities as orphaned instead of deleting', () => {
    const result = mergeRegistry(
      {
        areas: [localArea({ id: 'a1', haAreaId: 'gone', haName: 'Gone', name: 'Gone' })],
        devices: [
          localDevice({ id: 'x1', name: 'Old', haDeviceId: 'gone-dev', haName: 'Old' }),
        ],
      },
      { areas: [], devices: [] }
    );
    expect(result.areaUpdates).toEqual([{ id: 'a1', data: { haOrphaned: true } }]);
    expect(result.deviceUpdates).toEqual([{ id: 'x1', data: { haOrphaned: true } }]);
  });

  it('clears the orphaned flag when the entity reappears', () => {
    const result = mergeRegistry(
      {
        areas: [
          localArea({ id: 'a1', haAreaId: 'wz', haName: 'WZ', name: 'WZ', haOrphaned: true }),
        ],
        devices: [],
      },
      { areas: [remoteArea('wz', 'WZ')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([{ id: 'a1', data: { haOrphaned: false } }]);
  });

  it('leaves purely local entities untouched', () => {
    const result = mergeRegistry(
      {
        areas: [localArea({ id: 'a1', name: 'Keller' })],
        devices: [localDevice({ id: 'x1', name: 'Sicherung F7' })],
      },
      { areas: [], devices: [] }
    );
    expect(result.areaUpdates).toHaveLength(0);
    expect(result.deviceUpdates).toHaveLength(0);
  });

  it('skips HA service devices', () => {
    const result = mergeRegistry(
      { areas: [], devices: [] },
      {
        areas: [],
        devices: [remoteDevice({ id: 'sun', name: 'Sun', entry_type: 'service' })],
      }
    );
    expect(result.deviceCreates).toHaveLength(0);
  });
});
