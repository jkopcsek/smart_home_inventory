import { Inject, Injectable, Logger } from '@nestjs/common';
import { HaCapabilitySuggestionDto } from '@smart-home-inventory/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HA_REGISTRY_CLIENT, HaEntity, HaRegistryClient } from './ha-registry.types';

/** Integrations whose platform alone is a confident, protocol-specific
 *  signal — unlike `mqtt`, which just means "some MQTT-discovered entity"
 *  and could be Zigbee2MQTT, ESPHome, Tasmota, or anything else, so it's
 *  deliberately left out here rather than guessed. */
const PLATFORM_CAPABILITIES: Record<string, string[]> = {
  zwave_js: ['zwave'],
  matter: ['matter'],
  esphome: ['wifi'],
  bluetooth_le_tracker: ['bluetooth'],
  bluetooth: ['bluetooth'],
};

function suggestKeysFromEntities(entities: HaEntity[]): string[] {
  const platforms = new Set(entities.map((e) => e.platform));
  const hasBattery = entities.some((e) => e.device_class === 'battery');
  const keys = new Set<string>();

  for (const platform of platforms) {
    for (const key of PLATFORM_CAPABILITIES[platform] ?? []) keys.add(key);
  }

  if (platforms.has('zha')) {
    // Native ZHA reports the real Zigbee role signal directly, unlike a
    // static external catalog match — see zigbee-catalog.service.ts for
    // the same heuristic applied to devices not paired through HA at all.
    if (hasBattery) {
      keys.add('zigbee_end_device');
    } else {
      keys.add('zigbee_router');
      keys.add('mains_230v');
    }
  }

  if (hasBattery) keys.add('battery');

  return [...keys];
}

@Injectable()
export class HaCapabilitySuggestionsService {
  private readonly logger = new Logger(HaCapabilitySuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(HA_REGISTRY_CLIENT) private readonly client: HaRegistryClient
  ) {}

  /** Null when the device isn't HA-sourced, or HA can't be reached — a
   *  suggestion is a nice-to-have, never worth failing the device page for. */
  async forDevice(deviceId: string): Promise<HaCapabilitySuggestionDto | null> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { haDeviceId: true },
    });
    if (!device?.haDeviceId) return null;

    let entities: HaEntity[];
    try {
      entities = await this.client.listEntities();
    } catch (err) {
      this.logger.warn(`Could not fetch HA entity registry: ${(err as Error).message}`);
      return null;
    }

    const own = entities.filter((e) => e.device_id === device.haDeviceId);
    const keys = suggestKeysFromEntities(own);
    if (keys.length === 0) return { suggestedCapabilities: [] };

    const types = await this.prisma.capabilityType.findMany({ where: { key: { in: keys } } });
    const byKey = new Map(types.map((t) => [t.key, t]));
    return {
      suggestedCapabilities: keys.flatMap((key) => {
        const type = byKey.get(key);
        return type ? [{ key, label: type.label }] : [];
      }),
    };
  }
}
