import { LocalArea, LocalDevice, LocalFloor, mergeRegistry } from './ha-sync.merge';
import { HaArea, HaDevice, HaFloor } from './ha-registry.types';

const remoteFloor = (id: string, name: string, level: number | null = null): HaFloor => ({
  floor_id: id,
  name,
  level,
});

const remoteArea = (id: string, name: string, floorId: string | null = null): HaArea => ({
  area_id: id,
  name,
  floor_id: floorId,
});

const remoteDevice = (overrides: Partial<HaDevice> & { id: string }): HaDevice => ({
  name: null,
  name_by_user: null,
  manufacturer: null,
  model: null,
  area_id: null,
  entry_type: null,
  ...overrides,
});

const localFloor = (overrides: Partial<LocalFloor> & { id: string }): LocalFloor => ({
  name: overrides.id,
  haFloorId: null,
  haName: null,
  haOrphaned: false,
  ...overrides,
});

const localArea = (overrides: Partial<LocalArea> & { id: string }): LocalArea => ({
  name: overrides.id,
  floorId: null,
  haAreaId: null,
  haName: null,
  haFloorIdAtSync: null,
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
  it('creates floors, rooms and devices for new HA entities', () => {
    const result = mergeRegistry(
      { floors: [], areas: [], devices: [] },
      {
        floors: [remoteFloor('eg', 'Erdgeschoss', 0)],
        areas: [remoteArea('wz', 'Wohnzimmer', 'eg')],
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
    expect(result.floorCreates).toEqual([{ haFloorId: 'eg', name: 'Erdgeschoss', level: 0 }]);
    expect(result.areaCreates).toEqual([
      { haAreaId: 'wz', name: 'Wohnzimmer', haFloorRef: 'eg' },
    ]);
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
        floors: [localFloor({ id: 'f1', name: 'Erdgeschoss', haFloorId: 'eg', haName: 'Erdgeschoss' })],
        areas: [
          localArea({
            id: 'a1',
            name: 'Wohnzimmer',
            floorId: 'f1',
            haAreaId: 'wz',
            haName: 'Wohnzimmer',
            haFloorIdAtSync: 'eg',
          }),
        ],
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
        floors: [remoteFloor('eg', 'Erdgeschoss', 0)],
        areas: [remoteArea('wz', 'Wohnzimmer', 'eg')],
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
    expect(result.floorCreates).toHaveLength(0);
    expect(result.floorUpdates).toHaveLength(0);
    expect(result.areaCreates).toHaveLength(0);
    expect(result.areaUpdates).toHaveLength(0);
    expect(result.deviceCreates).toHaveLength(0);
    expect(result.deviceUpdates).toHaveLength(0);
  });

  it('follows HA renames while the user has not renamed locally', () => {
    const result = mergeRegistry(
      {
        floors: [],
        areas: [localArea({ id: 'a1', name: 'Wohnzimmer', haAreaId: 'wz', haName: 'Wohnzimmer' })],
        devices: [],
      },
      { floors: [], areas: [remoteArea('wz', 'Living room')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([
      { id: 'a1', data: { name: 'Living room', haName: 'Living room' } },
    ]);
  });

  it('keeps the local name once the user renamed it', () => {
    const result = mergeRegistry(
      {
        floors: [],
        areas: [localArea({ id: 'a1', name: 'Stube', haAreaId: 'wz', haName: 'Wohnzimmer' })],
        devices: [],
      },
      { floors: [], areas: [remoteArea('wz', 'Living room')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([
      { id: 'a1', data: { haName: 'Living room' } },
    ]);
  });

  it('follows HA floor renames while the user has not renamed locally', () => {
    const result = mergeRegistry(
      {
        floors: [localFloor({ id: 'f1', name: 'Erdgeschoss', haFloorId: 'eg', haName: 'Erdgeschoss' })],
        areas: [],
        devices: [],
      },
      { floors: [remoteFloor('eg', 'Ground floor')], areas: [], devices: [] }
    );
    expect(result.floorUpdates).toEqual([
      { id: 'f1', data: { name: 'Ground floor', haName: 'Ground floor' } },
    ]);
  });

  it('never overwrites user-entered manufacturer/model', () => {
    const result = mergeRegistry(
      {
        floors: [],
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
        floors: [],
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
        floors: [],
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
        floors: [],
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
        floors: [],
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
        floors: [],
        areas: [remoteArea('wz', 'WZ'), remoteArea('sz', 'SZ')],
        devices: [remoteDevice({ id: 'd1', name: 'Sensor', area_id: 'flur' })],
      }
    );
    expect(userMoved.deviceUpdates).toEqual([
      { id: 'x1', data: { haAreaIdAtSync: 'flur' } },
    ]);
  });

  it('follows HA floor moves until the user manually reassigns', () => {
    const floors = [
      localFloor({ id: 'f1', haFloorId: 'eg', haName: 'EG', name: 'EG' }),
      localFloor({ id: 'f2', haFloorId: 'og', haName: 'OG', name: 'OG' }),
    ];
    // Area still where sync put it → follows the HA move.
    const follows = mergeRegistry(
      {
        floors,
        areas: [
          localArea({
            id: 'a1',
            name: 'Flur',
            haAreaId: 'flur',
            haName: 'Flur',
            floorId: 'f1',
            haFloorIdAtSync: 'eg',
          }),
        ],
        devices: [],
      },
      {
        floors: [remoteFloor('eg', 'EG'), remoteFloor('og', 'OG')],
        areas: [remoteArea('flur', 'Flur', 'og')],
        devices: [],
      }
    );
    expect(follows.areaUpdates).toEqual([
      { id: 'a1', data: { haFloorIdAtSync: 'og' }, haFloorRef: 'og' },
    ]);

    // User moved the area to f2 themselves → HA move is NOT applied.
    const userMoved = mergeRegistry(
      {
        floors,
        areas: [
          localArea({
            id: 'a1',
            name: 'Flur',
            haAreaId: 'flur',
            haName: 'Flur',
            floorId: 'f2',
            haFloorIdAtSync: 'eg',
          }),
        ],
        devices: [],
      },
      {
        floors: [remoteFloor('eg', 'EG'), remoteFloor('og', 'OG')],
        areas: [remoteArea('flur', 'Flur', 'dachboden')],
        devices: [],
      }
    );
    expect(userMoved.areaUpdates).toEqual([
      { id: 'a1', data: { haFloorIdAtSync: 'dachboden' } },
    ]);
  });

  it('flags disappeared entities as orphaned instead of deleting', () => {
    const result = mergeRegistry(
      {
        floors: [localFloor({ id: 'f1', haFloorId: 'gone', haName: 'Gone', name: 'Gone' })],
        areas: [localArea({ id: 'a1', haAreaId: 'gone', haName: 'Gone', name: 'Gone' })],
        devices: [
          localDevice({ id: 'x1', name: 'Old', haDeviceId: 'gone-dev', haName: 'Old' }),
        ],
      },
      { floors: [], areas: [], devices: [] }
    );
    expect(result.floorUpdates).toEqual([{ id: 'f1', data: { haOrphaned: true } }]);
    expect(result.areaUpdates).toEqual([{ id: 'a1', data: { haOrphaned: true } }]);
    expect(result.deviceUpdates).toEqual([{ id: 'x1', data: { haOrphaned: true } }]);
  });

  it('clears the orphaned flag when the entity reappears', () => {
    const result = mergeRegistry(
      {
        floors: [],
        areas: [
          localArea({ id: 'a1', haAreaId: 'wz', haName: 'WZ', name: 'WZ', haOrphaned: true }),
        ],
        devices: [],
      },
      { floors: [], areas: [remoteArea('wz', 'WZ')], devices: [] }
    );
    expect(result.areaUpdates).toEqual([{ id: 'a1', data: { haOrphaned: false } }]);
  });

  it('leaves purely local entities untouched', () => {
    const result = mergeRegistry(
      {
        floors: [localFloor({ id: 'f1', name: 'Keller' })],
        areas: [localArea({ id: 'a1', name: 'Keller' })],
        devices: [localDevice({ id: 'x1', name: 'Sicherung F7' })],
      },
      { floors: [], areas: [], devices: [] }
    );
    expect(result.floorUpdates).toHaveLength(0);
    expect(result.areaUpdates).toHaveLength(0);
    expect(result.deviceUpdates).toHaveLength(0);
  });

  it('skips HA service devices', () => {
    const result = mergeRegistry(
      { floors: [], areas: [], devices: [] },
      {
        floors: [],
        areas: [],
        devices: [remoteDevice({ id: 'sun', name: 'Sun', entry_type: 'service' })],
      }
    );
    expect(result.deviceCreates).toHaveLength(0);
  });
});
