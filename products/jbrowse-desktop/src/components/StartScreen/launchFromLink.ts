import { loadSessionSpec, parseSessionSpecUrl } from '@jbrowse/app-core'

import type { JBrowseConfig } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// Turns a JBrowse Web link into a Desktop session. Web resolves these out of its
// address bar; Desktop gets the same result by parsing the link, loading the
// config it names, and running the identical loadSessionSpec — the
// LaunchView-<type> extension points it dispatches to are registered by the same
// plugins Desktop already loads.
//
// Both steps are injected, so the flow is exercisable without Electron and
// neither fetching nor session-file bookkeeping is duplicated here.
export interface LaunchFromLinkDeps {
  // fetch a hosted config, resolved and normalized the way Desktop loads any
  // other remote config (relative uris rebased, source url recorded)
  fetchConfig: (url: string) => Promise<JBrowseConfig>
  // build a plugin manager around that config, or around no config at all when
  // the spec carries its own assemblies
  createPluginManager: (config?: JBrowseConfig) => Promise<PluginManager>
}

export async function launchFromLink(
  link: string,
  { fetchConfig, createPluginManager }: LaunchFromLinkDeps,
): Promise<PluginManager> {
  const { configUrl, spec, sessionName } = parseSessionSpecUrl(link)
  // a spec carrying its own sessionAssemblies needs no config; anything else
  // resolves its assembly/track names against the config the link points at
  const config = configUrl ? await fetchConfig(configUrl) : undefined
  const pluginManager = await createPluginManager(config)
  await loadSessionSpec({ ...spec, sessionName }, pluginManager)
  return pluginManager
}
