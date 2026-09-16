/**
 * Stamp `baseUri` next to every `uri` in a config, and beside a MultiWiggle
 * `bigWigs` array of bare URI strings, so relative URIs resolve against the
 * location the config itself was loaded from. jbrowse-web runs this
 * when it fetches a config.json from a URL; anything that injects a fetched
 * config as an object (a hub, a track hub connection, a headless render) has to
 * run it too, or the config's relative data URIs resolve against the page.
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
      const value = config[key]
      if (typeof value === 'object' && value !== null) {
        addRelativeUris(value as Record<string, unknown>, base)
      }
      if (key === 'uri' || (key === 'bigWigs' && Array.isArray(value))) {
        config.baseUri ??= base.href
      }
    }
  }
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
 * Inverse of {@link addRelativeUris}: recursively delete every synthetic
 * `baseUri` key (mutates in place), e.g. before serializing a config snapshot
 * back out in the admin "Save config" flow or a "Copy config" button.
 */
export function stripBaseUris<T>(config: T): T {
  if (typeof config === 'object' && config !== null) {
    for (const key of Object.keys(config)) {
      const obj = config as Record<string, unknown>
      if (key === 'baseUri') {
        delete obj[key]
      } else {
        stripBaseUris(obj[key])
      }
    }
  }
  return config
}
