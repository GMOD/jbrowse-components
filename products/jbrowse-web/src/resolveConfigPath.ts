import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'

// Where a jbrowse-web page's config lives, resolved one way for everyone: the
// explicit ?config= param, else the build-time global, else config.json.
//
// Its callers have to agree. fetchRemoteConfig stamps the resolved URL onto
// every relative uri in the config (addRelativeUris), so "volvox.2bit" in
// data/config.json means data/volvox.2bit, and the admin save strips exactly
// that URL back off; permanentPlugins keys its plugin list by it too. A
// drifting copy of this resolution would strip nothing, and every synthetic
// baseUri would land in the admin's config.json.
export function resolveConfigPath(configPath?: string) {
  return configPath || window.__jbrowseConfigPath || 'config.json'
}

export function configBaseUri(configPath: string) {
  return new URL(configPath, window.location.href)
}

/**
 * The config as the admin server should write it back: without the baseUris
 * fetchRemoteConfig stamped, but keeping any its author wrote, or that came in
 * with something added from elsewhere.
 */
export function configForAdminSave<T>(config: T, configPath?: string) {
  return stripBaseUris(
    structuredClone(config),
    configBaseUri(resolveConfigPath(configPath)).href,
  )
}
