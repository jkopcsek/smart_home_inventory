import { HaArea, HaDevice, HaEntity, HaFloor } from '../ha-registry.types';

export const FIXTURE_FLOORS: HaFloor[] = [
  { floor_id: 'eg', name: 'Erdgeschoss', level: 0 },
  { floor_id: 'og', name: 'Obergeschoss', level: 1 },
];

export const FIXTURE_AREAS: HaArea[] = [
  { area_id: 'wohnzimmer', name: 'Wohnzimmer', floor_id: 'eg' },
  { area_id: 'kueche', name: 'Küche', floor_id: 'eg' },
  { area_id: 'schlafzimmer', name: 'Schlafzimmer', floor_id: 'og' },
  { area_id: 'flur', name: 'Flur', floor_id: 'eg' },
  { area_id: 'technikraum', name: 'Technikraum', floor_id: null },
];

export const FIXTURE_DEVICES: HaDevice[] = [
  {
    id: 'mock-hue-bridge',
    name: 'Philips Hue Bridge',
    name_by_user: null,
    manufacturer: 'Signify',
    model: 'BSB002',
    area_id: 'technikraum',
    entry_type: null,
  },
  {
    id: 'mock-hue-lamp-wz',
    name: 'Hue color lamp',
    name_by_user: 'Stehlampe Wohnzimmer',
    manufacturer: 'Signify',
    model: 'LCA001',
    area_id: 'wohnzimmer',
    entry_type: null,
  },
  {
    id: 'mock-zigbee-coordinator',
    name: 'SkyConnect',
    name_by_user: null,
    manufacturer: 'Nabu Casa',
    model: 'Home Assistant SkyConnect',
    area_id: 'technikraum',
    entry_type: null,
  },
  {
    id: 'mock-motion-flur',
    name: 'Motion sensor',
    name_by_user: 'Bewegungsmelder Flur',
    manufacturer: 'Aqara',
    model: 'RTCGQ11LM',
    area_id: 'flur',
    entry_type: null,
  },
  {
    id: 'mock-thermostat-sz',
    name: 'Radiator thermostat',
    name_by_user: 'Heizung Schlafzimmer',
    manufacturer: 'eQ-3',
    model: 'HmIP-eTRV-2',
    area_id: 'schlafzimmer',
    entry_type: null,
  },
  {
    id: 'mock-sun-service',
    name: 'Sun',
    name_by_user: null,
    manufacturer: null,
    model: null,
    area_id: null,
    entry_type: 'service',
  },
];

export const FIXTURE_ENTITIES: HaEntity[] = [
  {
    entity_id: 'light.hue_bridge_update',
    device_id: 'mock-hue-bridge',
    platform: 'hue',
    device_class: 'firmware',
  },
  {
    entity_id: 'light.stehlampe_wohnzimmer',
    device_id: 'mock-hue-lamp-wz',
    platform: 'hue',
    device_class: null,
  },
  {
    entity_id: 'update.skyconnect_firmware',
    device_id: 'mock-zigbee-coordinator',
    platform: 'zha',
    device_class: 'firmware',
  },
  {
    entity_id: 'binary_sensor.bewegungsmelder_flur_occupancy',
    device_id: 'mock-motion-flur',
    platform: 'zha',
    device_class: 'motion',
  },
  {
    entity_id: 'sensor.bewegungsmelder_flur_battery',
    device_id: 'mock-motion-flur',
    platform: 'zha',
    device_class: 'battery',
  },
  {
    entity_id: 'climate.heizung_schlafzimmer',
    device_id: 'mock-thermostat-sz',
    platform: 'zha',
    device_class: null,
  },
  {
    entity_id: 'sensor.heizung_schlafzimmer_battery',
    device_id: 'mock-thermostat-sz',
    platform: 'zha',
    device_class: 'battery',
  },
];
