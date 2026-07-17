import { pluginUrl } from '@jbrowse/core/PluginLoader'

import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

// Persisted "Yes, I trust it" decisions from the cross-origin plugin warning
// dialog, keyed by exact plugin URL. Stored in localStorage, which the browser
// partitions by origin: a decision made on a dev instance (localhost:3000) is
// never readable by a hosted deployment (jbrowse.org), and vice versa. That
// partitioning is what makes remembering safe — a malicious cross-origin link
// can only ever trigger a fresh prompt on the origin it targets, it can't
// pre-seed another origin's trust store. Web-only on purpose: Desktop runs
// plugins with Node privileges and has no such partitioning, so it never
// persists (see assertPluginsTrusted).
const STORAGE_KEY = 'jbrowse-trusted-plugins'

function readTrusted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch (e) {
    console.error(e)
    return new Set()
  }
}

// Records the user's approval of a set of plugins so the warning dialog doesn't
// reappear for them on this origin after a refresh.
export function rememberPlugins(defs: PluginDefinition[]) {
  try {
    const trusted = readTrusted()
    for (const d of defs) {
      trusted.add(pluginUrl(d))
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...trusted]))
  } catch (e) {
    console.error(e)
  }
}

// True when every plugin has already been vouched for on this origin. An empty
// list is trivially remembered, matching checkPlugins treating [] as safe.
export function arePluginsRemembered(defs: PluginDefinition[]) {
  const trusted = readTrusted()
  return defs.every(d => trusted.has(pluginUrl(d)))
}

// Revokes every remembered plugin approval on this origin.
export function forgetTrustedPlugins() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error(e)
  }
}
