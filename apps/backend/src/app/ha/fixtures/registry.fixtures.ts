import { HaArea, HaDevice } from '../ha-registry.types';

export const FIXTURE_AREAS: HaArea[] = [
  { area_id: 'wohnzimmer', name: 'Wohnzimmer' },
  { area_id: 'kueche', name: 'Küche' },
  { area_id: 'schlafzimmer', name: 'Schlafzimmer' },
  { area_id: 'flur', name: 'Flur' },
  { area_id: 'technikraum', name: 'Technikraum' },
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
