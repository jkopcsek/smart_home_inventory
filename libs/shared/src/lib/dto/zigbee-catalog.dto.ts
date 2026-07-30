export interface ZigbeeCatalogSuggestedCapability {
  key: string;
  label: string;
}

/** A match against the static Zigbee2MQTT device catalog snapshot (see
 *  tools/zigbee-catalog/generate.js) for a device's manufacturer/model —
 *  purely informational; nothing here is applied automatically. */
export interface ZigbeeCatalogMatchDto {
  vendor: string;
  model: string;
  description: string;
  /** A directly-linkable product photo URL if one resolves on
   *  zigbee2mqtt.io, otherwise null — never cached/guessed without a live check. */
  imageUrl: string | null;
  suggestedCapabilities: ZigbeeCatalogSuggestedCapability[];
}
