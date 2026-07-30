import { Injectable } from '@nestjs/common';
import { CapabilityType } from '@smart-home-inventory/prisma';
import { ZigbeeCatalogMatchDto, ZigbeeCatalogSuggestedCapability } from '@smart-home-inventory/shared';
import { PrismaService } from '../prisma/prisma.service';
import catalogData from './data/zigbee-catalog-data.json';

interface CatalogEntry {
  vendor: string;
  model: string;
  description: string;
  identifiers: string[];
  suggestedCapabilities: string[];
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

function sanitizeModelForImage(model: string): string {
  return model.replace(/[/:' ]/g, '-');
}

/**
 * Matches a device's manufacturer/model against a static snapshot of the
 * Zigbee2MQTT device catalog (see tools/zigbee-catalog/generate.js for how
 * it's generated and why it's a checked-in snapshot rather than a runtime
 * dependency on zigbee-herdsman-converters). Purely a lookup — nothing here
 * writes to the database; the frontend decides what to do with a match.
 */
@Injectable()
export class ZigbeeCatalogService {
  private readonly byIdentifier = new Map<string, CatalogEntry>();
  private readonly imageUrlCache = new Map<string, string | null>();

  constructor(private readonly prisma: PrismaService) {
    for (const entry of catalogData as CatalogEntry[]) {
      for (const id of entry.identifiers) {
        this.byIdentifier.set(id, entry);
      }
    }
  }

  async match(model: string): Promise<ZigbeeCatalogMatchDto | null> {
    const entry = this.byIdentifier.get(model.trim().toLowerCase());
    if (!entry) return null;
    const [imageUrl, suggestedCapabilities] = await Promise.all([
      this.resolveImageUrl(entry.model),
      this.resolveSuggestedCapabilities(entry.suggestedCapabilities),
    ]);
    return {
      vendor: entry.vendor,
      model: entry.model,
      description: entry.description,
      imageUrl,
      suggestedCapabilities,
    };
  }

  /** Zigbee2MQTT hosts a static image per device model on its docs site
   *  (no documented API, but a stable, CORS-open URL pattern) — probed live
   *  since neither the exact filename extension nor the image's continued
   *  existence is guaranteed by the static catalog snapshot. */
  private async resolveImageUrl(model: string): Promise<string | null> {
    if (this.imageUrlCache.has(model)) return this.imageUrlCache.get(model) ?? null;
    const base = `https://www.zigbee2mqtt.io/images/devices/${sanitizeModelForImage(model)}`;
    for (const ext of IMAGE_EXTENSIONS) {
      const url = `${base}${ext}`;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          this.imageUrlCache.set(model, url);
          return url;
        }
      } catch {
        // Network hiccup or offline install — treat like "no image found".
      }
    }
    this.imageUrlCache.set(model, null);
    return null;
  }

  /** Only surface suggestions for capability keys that actually still exist
   *  (system capabilities can in principle be renamed/removed). */
  private async resolveSuggestedCapabilities(keys: string[]): Promise<ZigbeeCatalogSuggestedCapability[]> {
    if (keys.length === 0) return [];
    const types = await this.prisma.capabilityType.findMany({ where: { key: { in: keys } } });
    const byKey = new Map<string, CapabilityType>(types.map((t) => [t.key, t]));
    return keys.flatMap((key) => {
      const type = byKey.get(key);
      return type ? [{ key, label: type.label }] : [];
    });
  }
}
