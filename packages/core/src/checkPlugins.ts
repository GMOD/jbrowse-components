import { pluginUrl } from './PluginLoader.ts'

import type { PluginDefinition } from './PluginLoader.ts'
import type { JBrowsePlugin } from './util/types/index.ts'

// Whether a set of plugin definitions is safe to load without asking the user.
// Lives in core rather than a product because every product that can be handed
// a config by an untrusted party needs the same gate: Web from its address bar,
// Desktop from a jbrowse:// link. Loading a plugin runs its javascript with the
// product's full privileges — in Desktop that is Node — so a product must not
// reach PluginLoader with unvetted definitions.

export const TRUSTED_PLUGIN_URL_PREFIXES = ['https://jbrowse.org/plugins/']

export async function fetchPlugins() {
  const response = await fetch(
    'https://jbrowse.org/plugin-store/v2/plugins.json',
  )
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} fetching plugins`,
    )
  }
  return response.json() as Promise<{ plugins: JBrowsePlugin[] }>
}

function isTrustedUrl(url: string) {
  return TRUSTED_PLUGIN_URL_PREFIXES.some(prefix => url.startsWith(prefix))
}

// Every url a store entry can resolve to: the top-level fallback plus each
// version-pinned build. A config plugin is "in the store" if its url is any of
// these.
function storePluginUrls(p: JBrowsePlugin) {
  const top = [p.url, p.umdUrl, p.esmUrl, p.cjsUrl]
  const versioned = (p.versions ?? []).flatMap(v => [
    v.url,
    v.umdUrl,
    v.esmUrl,
    v.cjsUrl,
  ])
  return [...top, ...versioned].filter(url => url !== undefined)
}

export function checkPluginsAgainstStore(
  pluginsToCheck: PluginDefinition[],
  storePlugins: { plugins: JBrowsePlugin[] },
) {
  if (pluginsToCheck.length === 0) {
    return true
  }
  const storeUrls = new Set(storePlugins.plugins.flatMap(storePluginUrls))
  return pluginsToCheck.every(
    p => isTrustedUrl(pluginUrl(p)) || storeUrls.has(pluginUrl(p)),
  )
}

export async function checkPlugins(pluginsToCheck: PluginDefinition[]) {
  // Trusted-by-prefix plugins are accepted without consulting the store, so
  // when every plugin is already trusted (the common case: an empty list, or
  // jbrowse.org-hosted plugins) skip the network entirely. This keeps a
  // plugin-store outage — or being offline — from blocking a config/session
  // load that needed no verification (e.g. restoring your own local session).
  if (pluginsToCheck.every(p => isTrustedUrl(pluginUrl(p)))) {
    return true
  }
  return checkPluginsAgainstStore(pluginsToCheck, await fetchPlugins())
}
