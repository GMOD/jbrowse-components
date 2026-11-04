/**
 * Stamp `baseUri` next to every `uri` in a config, and beside a MultiWiggle
 * `bigWigs` array of bare URI strings, so relative URIs resolve against the
 * location the config itself was loaded from. A file written as a bare string
 * where a location object can go (a search index, `refNameAliases`,
 * `cytobands`, a `bedLocations` entry) has no object to stamp, so it becomes
 * `{ uri, baseUri }`.
 * jbrowse-web runs this when it fetches a config.json from a URL; anything that
 * injects a fetched config as an object (a hub, a track hub connection, a
 * headless render) has to run it too, or the config's relative data URIs
 * resolve against the page.
 *
 * Lives in core because core is what consumes the result — the assembly config
 * schema and expandAssemblyConfigShorthand read `baseUri` back out.
 */
export function addRelativeUris(
  config: Record<string, unknown> | null,
  base: URL,
) {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      const value = liftBareFiles(key, config[key])
      if (value !== config[key]) {
        config[key] = value
      }
      if (typeof value === 'object' && value !== null) {
        addRelativeUris(value as Record<string, unknown>, base)
      }
      if (key === 'uri' || (key === 'bigWigs' && Array.isArray(value))) {
        config.baseUri ??= base.href
      }
    }
  }
}

// the keys whose value may be a file written as a bare string, which has no
// object to carry a baseUri until it becomes `{ uri }`
const FILE_KEYS = new Set(['textSearchAdapter', 'refNameAliases', 'cytobands'])
const FILE_LIST_KEYS = new Set(['aggregateTextSearchAdapters', 'bedLocations'])

function liftBareFiles(key: string, value: unknown) {
  const lift = (file: unknown) =>
    typeof file === 'string' ? { uri: file } : file
  return FILE_KEYS.has(key)
    ? lift(value)
    : FILE_LIST_KEYS.has(key) &&
        Array.isArray(value) &&
        value.some(file => typeof file === 'string')
      ? value.map(lift)
      : value
}

/**
 * A copy of `config` with every relative URI stamped against the page, which
 * is what the page itself would resolve it against. An RPC worker started from
 * a `blob:` URL has no such base, so a location it receives without one fails
 * to parse there.
 */
export function withPageBaseUri<T>(config: T): T {
  if (typeof document === 'undefined' || config === undefined) {
    return config
  }
  const copy = structuredClone(config)
  addRelativeUris(copy as Record<string, unknown>, new URL(document.baseURI))
  return copy
}

/**
 * Inverse of {@link addRelativeUris}: recursively delete `baseUri` keys
 * (mutates in place), e.g. before a "Copy config" button. Given the `base`
 * addRelativeUris stamped, only the keys equal to it go, so a `baseUri` the
 * config's author wrote survives the admin "Save config" round trip.
 */
export function stripBaseUris<T>(config: T, base?: string): T {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      const obj = config as Record<string, unknown>
      if (key === 'baseUri') {
        if (base === undefined || obj[key] === base) {
          delete obj[key]
        }
      } else {
        stripBaseUris(obj[key], base)
      }
    }
  }
  return config
}
