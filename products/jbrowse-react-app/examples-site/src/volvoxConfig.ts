import volvoxConfigJson from './volvox-config.json' with { type: 'json' }

// The volvox test config uses relative URIs (e.g. `volvox.2bit`). Tag every
// object that has a `uri` with a `baseUri` so JBrowse resolves them against the
// jbrowse.org test_data directory the config was downloaded from.
export function addRelativeUris(config: unknown, baseUri: string) {
  if (config !== null && typeof config === 'object') {
    const obj = config as Record<string, unknown>
    if (typeof obj.uri === 'string' && obj.baseUri === undefined) {
      obj.baseUri = baseUri
    }
    for (const value of Object.values(obj)) {
      addRelativeUris(value, baseUri)
    }
  }
}

const VOLVOX_CONFIG_URL =
  'https://jbrowse.org/code/jb2/main/test_data/volvox/config.json'

export const volvoxConfig = structuredClone(volvoxConfigJson)
addRelativeUris(volvoxConfig, VOLVOX_CONFIG_URL)
