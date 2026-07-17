/**
 * Stamp `baseUri` next to every `uri` in a config so relative URIs resolve
 * against the location the config itself was loaded from. jbrowse-web runs this
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
      if (typeof config[key] === 'object' && config[key] !== null) {
        addRelativeUris(config[key] as Record<string, unknown>, base)
      } else if (key === 'uri') {
        // fill only when absent, so a node carrying its own baseUri wins
        config.baseUri = config.baseUri ?? base.href
      }
    }
  }
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
