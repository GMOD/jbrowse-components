import {
  isStorePluginDefinition,
  maybePluginUrl,
  pluginUrl,
} from './pluginDefinitions.ts'

import type { PluginDefinition } from './pluginDefinitions.ts'
import type { JBrowsePlugin } from './util/types/index.ts'

// Whether a set of plugin definitions is safe to load without asking the user.
// Lives in core rather than a product because every product that can be handed
// a config by an untrusted party needs the same gate: Web from its address bar,
// Desktop from a jbrowse:// link. Loading a plugin runs its javascript with the
// product's full privileges — in Desktop that is Node — so a product must not
// reach PluginLoader with unvetted definitions.

export const TRUSTED_PLUGIN_URL_PREFIXES = ['https://jbrowse.org/plugins/']

// v2 adds per-version JBrowse compatibility ranges + integrity hashes; the v1
// plugins.json is still served for older clients. One constant, shared with the
// hook every install surface reads (util/useFetchPlugins.ts), because the gate
// and the list have to be looking at the same manifest — a second copy is how
// one of them silently ends up on the unhashed v1 list, and then the gate
// rejects a plugin the store just offered.
export const PLUGIN_STORE_URL =
  'https://jbrowse.org/plugin-store/v2/plugins.json'

export async function fetchPlugins() {
  const response = await fetch(PLUGIN_STORE_URL)
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

/**
 * Whether a definition can run without consulting the store listing or asking
 * the user.
 *
 * A store ref names a package, and resolution can only turn it into a
 * `https://jbrowse.org/plugins/` url — the prefix trusted outright above — so a
 * ref carrying no url of its own is trusted by construction. There would be
 * nothing to show a user anyway: the url does not exist until the manifest is
 * read.
 *
 * A ref that ALSO carries a fallback url is judged on that url, not on being a
 * ref. The fallback is what `resolveStoreRefs` loads when the store cannot
 * answer, so trusting the ref and ignoring the url would vet one thing and run
 * another — the same drift `assertSingleKind` and `pluginDescriptionString`
 * exist to prevent on the loader side.
 */
function isTrustedDefinition(def: PluginDefinition) {
  const url = maybePluginUrl(def)
  return url === undefined ? isStorePluginDefinition(def) : isTrustedUrl(url)
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
    p => isTrustedDefinition(p) || storeUrls.has(pluginUrl(p)),
  )
}

export async function checkPlugins(pluginsToCheck: PluginDefinition[]) {
  // Trusted-by-prefix plugins and store refs are accepted without consulting
  // the store listing, so when every plugin is already trusted (the common
  // case: an empty list, or jbrowse.org-hosted plugins) skip the network
  // entirely. This keeps a plugin-store outage — or being offline — from
  // blocking a config/session load that needed no verification (e.g. restoring
  // your own local session).
  if (pluginsToCheck.every(isTrustedDefinition)) {
    return true
  }
  return checkPluginsAgainstStore(pluginsToCheck, await fetchPlugins())
}
