#!/usr/bin/env node
/**
 * Regenerates apps/backend/src/app/zigbee-catalog/data/zigbee-catalog-data.json
 * from the `zigbee-herdsman-converters` npm package (the same device
 * definitions Zigbee2MQTT itself ships).
 *
 * That package depends on `zigbee-herdsman`, which depends on
 * `@serialport/bindings-cpp` — a native addon for talking to real Zigbee
 * radio hardware that has no business being a runtime dependency of this
 * app's backend (fragile to build in the HA add-on container, and entirely
 * unneeded — we only want the static device catalog). So this script is run
 * by hand, occasionally, in a throwaway directory (`npm install
 * zigbee-herdsman-converters --ignore-scripts` skips the native build since
 * we never call into it), and its *output* — this JSON file — is what
 * actually ships with the app.
 *
 * Usage:
 *   cd /tmp && npm init -y && npm install zigbee-herdsman-converters --ignore-scripts
 *   node <path-to-this-file>
 *   # then copy the resulting ./zigbee-catalog-data.json over the checked-in one.
 */
const fs = require('fs');
const mod = require('zigbee-herdsman-converters/devices/index');
const defs = mod.default || mod;

function exposesArray(def) {
  try {
    const e = typeof def.exposes === 'function' ? def.exposes({ isDummyDevice: true }, {}) : def.exposes;
    return Array.isArray(e) ? e : [];
  } catch {
    return [];
  }
}

/**
 * Zigbee Router (mains-powered, extends the mesh) vs. End Device (may be
 * battery-powered, "sleepy") — see the capability keys of the same name in
 * capabilities.service.ts. Only guess when there's a real signal (an
 * explicit `battery` expose, or a `powerSource` string); most definitions
 * have neither, and a device we're not confident about is left with no
 * suggestion at all rather than a wrong one.
 */
function suggestedCapabilities(def, exposes) {
  const hasBattery = exposes.some((e) => e.name === 'battery' || e.property === 'battery');
  const powerSource = (def.powerSource || '').toLowerCase();
  if (hasBattery || powerSource.includes('battery')) {
    return ['zigbee_end_device', 'battery'];
  }
  if (powerSource.includes('mains') || powerSource.includes('dc source')) {
    return ['zigbee_router', 'mains_230v'];
  }
  return [];
}

const entries = [];
for (const def of defs) {
  if (!def.model || !def.vendor) continue;
  const exposes = exposesArray(def);
  const identifiers = Array.from(
    new Set(
      [def.model, ...(Array.isArray(def.zigbeeModel) ? def.zigbeeModel : [])]
        .filter(Boolean)
        .map((s) => s.toLowerCase())
    )
  );
  entries.push({
    vendor: def.vendor,
    model: def.model,
    description: def.description || '',
    identifiers,
    suggestedCapabilities: suggestedCapabilities(def, exposes),
  });
}

fs.writeFileSync('./zigbee-catalog-data.json', JSON.stringify(entries));
console.log(`Wrote ${entries.length} entries (${fs.statSync('./zigbee-catalog-data.json').size} bytes) to ./zigbee-catalog-data.json`);
