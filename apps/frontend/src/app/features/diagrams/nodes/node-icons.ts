import {
  mdiAccessPointNetwork,
  mdiAirConditioner,
  mdiAirFilter,
  mdiAirHumidifier,
  mdiAirPurifier,
  mdiAlarmLight,
  mdiBattery,
  mdiBlinds,
  mdiCableData,
  mdiCctv,
  mdiCurrentAc,
  mdiCurtains,
  mdiDialpad,
  mdiDishwasher,
  mdiDoorbellVideo,
  mdiDoorOpen,
  mdiEvStation,
  mdiFan,
  mdiFridgeOutline,
  mdiFuse,
  mdiGarageVariant,
  mdiGate,
  mdiGauge,
  mdiGeneratorStationary,
  mdiHeatPump,
  mdiHomeAutomation,
  mdiHvac,
  mdiKettleOutline,
  mdiLightbulbOutline,
  mdiLightSwitch,
  mdiLockOutline,
  mdiMeterGas,
  mdiMicrowave,
  mdiMoleculeCo,
  mdiMotionSensor,
  mdiNas,
  mdiPipe,
  mdiPool,
  mdiPowerPlugOutline,
  mdiPowerSocketEu,
  mdiRadiator,
  mdiRemote,
  mdiRobotVacuum,
  mdiRouterWireless,
  mdiShieldHome,
  mdiSmokeDetectorOutline,
  mdiSolarPower,
  mdiSpeaker,
  mdiSprinkler,
  mdiStove,
  mdiSwitch,
  mdiTelevision,
  mdiThermometer,
  mdiThermostat,
  mdiValve,
  mdiWashingMachine,
  mdiWaterAlert,
  mdiWaterBoiler,
  mdiWaterPercent,
  mdiWaterPump,
  mdiWifi,
  mdiWindowClosedVariant,
  mdiZigbee,
} from '@mdi/js';

export interface NodeIconOption {
  key: string;
  label: string;
  path: string;
}

/** mdi icons relevant to documenting home electrical, network, plumbing/gas,
 *  heating/ventilation, security and appliance setups — not the full mdi
 *  set, which would swamp the filter with irrelevant results, but no longer
 *  needing to stay pocket-sized either now that the picker (see
 *  IconPickerDialogComponent) is searchable rather than one long dropdown.
 *  Referenced by key (see NodeDataBase.icon in diagram-content.ts), not by
 *  raw path, so this list can be extended/reordered without touching saved
 *  diagrams. */
export const NODE_ICONS: NodeIconOption[] = [
  // Electrical
  { key: 'fuse', label: 'Fuse', path: mdiFuse },
  { key: 'lightbulb', label: 'Lamp', path: mdiLightbulbOutline },
  { key: 'switch', label: 'Wall switch', path: mdiLightSwitch },
  { key: 'socket', label: 'Socket', path: mdiPowerSocketEu },
  { key: 'plug', label: 'Plug', path: mdiPowerPlugOutline },
  { key: 'cable', label: 'Cable', path: mdiCableData },
  { key: 'battery', label: 'Battery', path: mdiBattery },
  { key: 'solar_panel', label: 'Solar panel', path: mdiSolarPower },
  { key: 'inverter', label: 'Inverter', path: mdiCurrentAc },
  { key: 'generator', label: 'Generator', path: mdiGeneratorStationary },
  { key: 'ev_charger', label: 'EV charger', path: mdiEvStation },

  // Network / smart home
  { key: 'wifi', label: 'Wi-Fi', path: mdiWifi },
  { key: 'zigbee', label: 'Zigbee', path: mdiZigbee },
  { key: 'router', label: 'Router', path: mdiRouterWireless },
  { key: 'access_point', label: 'Access point', path: mdiAccessPointNetwork },
  { key: 'network_switch', label: 'Network switch', path: mdiSwitch },
  { key: 'nas', label: 'Server / NAS', path: mdiNas },
  { key: 'hub', label: 'Automation hub', path: mdiHomeAutomation },
  { key: 'remote', label: 'Remote', path: mdiRemote },
  { key: 'keypad', label: 'Keypad', path: mdiDialpad },

  // Sensors & safety
  { key: 'motion', label: 'Motion sensor', path: mdiMotionSensor },
  { key: 'door_sensor', label: 'Door sensor', path: mdiDoorOpen },
  { key: 'window_sensor', label: 'Window sensor', path: mdiWindowClosedVariant },
  { key: 'temperature_sensor', label: 'Temperature sensor', path: mdiThermometer },
  { key: 'humidity_sensor', label: 'Humidity sensor', path: mdiWaterPercent },
  { key: 'smoke', label: 'Smoke detector', path: mdiSmokeDetectorOutline },
  { key: 'co_detector', label: 'CO detector', path: mdiMoleculeCo },
  { key: 'leak', label: 'Leak sensor', path: mdiWaterAlert },
  { key: 'alarm', label: 'Alarm', path: mdiAlarmLight },
  { key: 'security_hub', label: 'Security hub', path: mdiShieldHome },
  { key: 'camera', label: 'Camera', path: mdiCctv },
  { key: 'doorbell', label: 'Doorbell', path: mdiDoorbellVideo },
  { key: 'lock', label: 'Lock', path: mdiLockOutline },

  // Climate / heating / ventilation
  { key: 'thermostat', label: 'Thermostat', path: mdiThermostat },
  { key: 'radiator', label: 'Radiator', path: mdiRadiator },
  { key: 'water_heater', label: 'Water heater', path: mdiWaterBoiler },
  { key: 'heat_pump', label: 'Heat pump', path: mdiHeatPump },
  { key: 'air_conditioner', label: 'Air conditioner', path: mdiAirConditioner },
  { key: 'fan', label: 'Fan', path: mdiFan },
  { key: 'hvac', label: 'Air handling unit', path: mdiHvac },
  { key: 'air_filter', label: 'Air filter', path: mdiAirFilter },
  { key: 'humidifier', label: 'Humidifier', path: mdiAirHumidifier },
  { key: 'air_purifier', label: 'Air purifier', path: mdiAirPurifier },

  // Plumbing / gas / outdoor
  { key: 'valve', label: 'Valve', path: mdiValve },
  { key: 'pipe', label: 'Pipe', path: mdiPipe },
  { key: 'pump', label: 'Pump', path: mdiWaterPump },
  { key: 'gas_meter', label: 'Gas meter', path: mdiMeterGas },
  { key: 'meter', label: 'Meter', path: mdiGauge },
  { key: 'sprinkler', label: 'Sprinkler', path: mdiSprinkler },
  { key: 'pool', label: 'Pool', path: mdiPool },
  { key: 'gate', label: 'Gate', path: mdiGate },
  { key: 'garage', label: 'Garage door', path: mdiGarageVariant },
  { key: 'blinds', label: 'Blinds', path: mdiBlinds },
  { key: 'curtains', label: 'Curtains', path: mdiCurtains },

  // Media & appliances
  { key: 'speaker', label: 'Speaker', path: mdiSpeaker },
  { key: 'tv', label: 'TV', path: mdiTelevision },
  { key: 'washing_machine', label: 'Washing machine', path: mdiWashingMachine },
  { key: 'dishwasher', label: 'Dishwasher', path: mdiDishwasher },
  { key: 'fridge', label: 'Fridge', path: mdiFridgeOutline },
  { key: 'oven', label: 'Oven / stove', path: mdiStove },
  { key: 'microwave', label: 'Microwave', path: mdiMicrowave },
  { key: 'kettle', label: 'Kettle', path: mdiKettleOutline },
  { key: 'vacuum', label: 'Robot vacuum', path: mdiRobotVacuum },
];

const NODE_ICON_MAP: Record<string, string> = Object.fromEntries(NODE_ICONS.map((i) => [i.key, i.path]));
const NODE_ICON_LABEL_MAP: Record<string, string> = Object.fromEntries(NODE_ICONS.map((i) => [i.key, i.label]));

export function nodeIconPath(key: string | undefined): string | null {
  return key ? (NODE_ICON_MAP[key] ?? null) : null;
}

export function nodeIconLabel(key: string | undefined): string {
  return key ? (NODE_ICON_LABEL_MAP[key] ?? key) : 'None';
}
