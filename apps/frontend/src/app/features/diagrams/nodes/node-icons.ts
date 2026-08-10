import {
  mdiCctv,
  mdiDoorbellVideo,
  mdiFan,
  mdiFuse,
  mdiGarageVariant,
  mdiLightbulbOutline,
  mdiLightSwitch,
  mdiLockOutline,
  mdiMotionSensor,
  mdiPowerPlugOutline,
  mdiPowerSocketEu,
  mdiRadiator,
  mdiRouterWireless,
  mdiSmokeDetectorOutline,
  mdiSpeaker,
  mdiTelevision,
  mdiThermostat,
  mdiValve,
  mdiWifi,
  mdiZigbee,
} from '@mdi/js';

export interface NodeIconOption {
  key: string;
  label: string;
  path: string;
}

/** A curated subset of mdi icons relevant to documenting home electrical/smart-home
 *  setups — not the full mdi set, which would make the picker unusable. Referenced
 *  by key (see NodeDataBase.icon in diagram-content.ts), not by raw path, so this
 *  list can be extended/reordered without touching saved diagrams. */
export const NODE_ICONS: NodeIconOption[] = [
  { key: 'fuse', label: 'Fuse', path: mdiFuse },
  { key: 'lightbulb', label: 'Lamp', path: mdiLightbulbOutline },
  { key: 'switch', label: 'Wall switch', path: mdiLightSwitch },
  { key: 'socket', label: 'Socket', path: mdiPowerSocketEu },
  { key: 'plug', label: 'Plug', path: mdiPowerPlugOutline },
  { key: 'radiator', label: 'Heating', path: mdiRadiator },
  { key: 'thermostat', label: 'Thermostat', path: mdiThermostat },
  { key: 'wifi', label: 'Wi-Fi', path: mdiWifi },
  { key: 'zigbee', label: 'Zigbee', path: mdiZigbee },
  { key: 'router', label: 'Router', path: mdiRouterWireless },
  { key: 'camera', label: 'Camera', path: mdiCctv },
  { key: 'speaker', label: 'Speaker', path: mdiSpeaker },
  { key: 'tv', label: 'TV', path: mdiTelevision },
  { key: 'fan', label: 'Fan', path: mdiFan },
  { key: 'garage', label: 'Garage door', path: mdiGarageVariant },
  { key: 'lock', label: 'Lock', path: mdiLockOutline },
  { key: 'doorbell', label: 'Doorbell', path: mdiDoorbellVideo },
  { key: 'motion', label: 'Motion sensor', path: mdiMotionSensor },
  { key: 'smoke', label: 'Smoke detector', path: mdiSmokeDetectorOutline },
  { key: 'valve', label: 'Valve', path: mdiValve },
];

const NODE_ICON_MAP: Record<string, string> = Object.fromEntries(NODE_ICONS.map((i) => [i.key, i.path]));

export function nodeIconPath(key: string | undefined): string | null {
  return key ? (NODE_ICON_MAP[key] ?? null) : null;
}
