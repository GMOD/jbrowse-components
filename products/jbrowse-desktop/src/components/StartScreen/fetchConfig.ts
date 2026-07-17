import { checkPlugins } from '@jbrowse/core/checkPlugins'
import { fetchJson } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'

import { assertPluginsTrusted } from './assertPluginsTrusted.ts'

import type { JBrowseConfig } from './types.ts'

// Kept out of util.tsx so it does not drag in the root model: this is a leaf
// that fetches and vets, and the security gate below is easier to trust — and
// to test — when its module graph is small.

const { ipcRenderer } = window.require('electron')

/**
 * Fetch one remote config and make it loadable here: rebase its relative uris on
 * where it was served from, and record that url so "export to web" can reuse it
 * as the session base (?config=<sourceConfigUrl>).
 *
 * This is the only way a config the user did not open from their own disk enters
 * Desktop, so it is where the plugins in one get vetted — gating the funnel
 * rather than each caller. Both routes here are reachable by someone else: a
 * jbrowse:// link is handed to us by any web page that wants to, and the start
 * screen's favorites are urls that can be added to. A config's plugins become
 * javascript that PluginLoader require()s into a renderer with Node, so an
 * unvetted one must not get that far. See assertPluginsTrusted.
 */
export async function fetchConfig(url: string) {
  const ret = await fetchJson(url)
  addRelativeUris(ret as Record<string, unknown>, new URL(url))
  const cfg = ret as JBrowseConfig
  cfg.configuration = {
    ...cfg.configuration,
    sourceConfigUrl: url,
  }
  await assertPluginsTrusted(cfg.plugins, {
    checkPlugins,
    confirm: plugins => ipcRenderer.invoke('confirmUntrustedPlugins', plugins),
  })
  return cfg
}
