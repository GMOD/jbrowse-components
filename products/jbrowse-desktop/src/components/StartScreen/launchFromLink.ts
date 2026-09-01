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

// A url whose path ends in .json is a config, not a link to a view of one:
// a hub's own `config.json`, or one of genomes.jbrowse.org's per-assembly
// files. It describes no session, which is why parseSessionSpecUrl reports
// that it has none — true, and no use to someone whose link is the config.
// Checked only after that parse fails, so `config.json?session=spec-...` is
// still read as the spec link it is.
function namesAConfig(link: string) {
  try {
    return new URL(link).pathname.endsWith('.json')
  } catch {
    return false
  }
}

export async function launchFromLink(
  link: string,
  { fetchConfig, createPluginManager }: LaunchFromLinkDeps,
): Promise<PluginManager> {
  let parsed
  try {
    parsed = parseSessionSpecUrl(link)
  } catch (e) {
    if (!namesAConfig(link)) {
      throw e
    }
  }
  if (parsed) {
    // a spec carrying its own sessionAssemblies needs no config; anything else
    // resolves its assembly/track names against the config the link points at
    const config = parsed.configUrl
      ? await fetchConfig(parsed.configUrl)
      : undefined
    const pluginManager = await createPluginManager(config)
    await loadSessionSpec(
      { ...parsed.spec, sessionName: parsed.sessionName },
      pluginManager,
    )
    return pluginManager
  } else {
    // no spec to run: the config's own defaultSession is the session, the same
    // as opening that config from a file
    return createPluginManager(await fetchConfig(link))
  }
}
