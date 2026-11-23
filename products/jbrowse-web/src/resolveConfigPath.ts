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
 * The url a config was served from: the response's own after a redirect to
 * another file, else the requested one, so a cache-buster query or a response
 * with no url leaves the base the admin save strips unchanged
 */
export function servedConfigUri(configPath: string, responseUrl?: string) {
  const requested = configBaseUri(configPath)
  const served = responseUrl ? new URL(responseUrl) : requested
  return served.origin === requested.origin &&
    served.pathname === requested.pathname
    ? requested
    : served
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
