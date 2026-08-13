// Where a jbrowse-web page's config lives, resolved one way for everyone: the
// explicit ?config= param, else the build-time global, else config.json.
//
// Two callers, and they have to agree. SessionLoader resolves it to fetch the
// config, and fetchRemoteConfig stamps the resulting URL onto every relative
// uri in it (addRelativeUris) so "volvox.2bit" in data/config.json means
// data/volvox.2bit. The plugin-reload path then has to re-stamp against the
// same URL, because the snapshot it hands the replacement app has had those
// keys stripped on the way out. A second, drifting copy of this resolution
// would give the replacement a different base than the original fetch used,
// which is silent: the tracks just 404.
export function resolveConfigPath(configPath?: string) {
  return configPath || window.__jbrowseConfigPath || 'config.json'
}

export function configBaseUri(configPath: string) {
  return new URL(configPath, window.location.href)
}
