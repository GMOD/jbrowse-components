import { maybePluginUrl } from '@jbrowse/core/pluginDefinitions'
import {
  localStorageGetStringArray,
  localStorageRemoveItem,
  localStorageSetJSON,
} from '@jbrowse/core/util'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

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

// A string list, not a raw JSON read: a corrupt entry would otherwise put a
// non-string into the trust set, where it can only ever fail to match a plugin
// URL — but silently, and forever.
function readTrusted() {
  return new Set(localStorageGetStringArray(STORAGE_KEY))
}

// Records the user's approval of a set of plugins so the warning dialog doesn't
// reappear for them on this origin after a refresh.
//
// maybePluginUrl, so a definition naming no loader records nothing: pluginUrl's
// miss value is the display string 'unknown url', and writing that into the trust
// set marked every *other* unloadable definition — a different plugin, from a
// different origin's link — as already approved. It also cannot be matched back,
// since nothing loads from it.
export function rememberPlugins(defs: PluginDefinition[]) {
  const trusted = readTrusted()
  for (const d of defs) {
    const url = maybePluginUrl(d)
    if (url !== undefined) {
      trusted.add(url)
    }
  }
  localStorageSetJSON(STORAGE_KEY, [...trusted])
}

// True when every plugin has already been vouched for on this origin. An empty
// list is trivially remembered, matching checkPlugins treating [] as safe. A
// definition with no url is never remembered — rememberPlugins stores none, and
// this is the gate that decides whether to skip the prompt.
export function arePluginsRemembered(defs: PluginDefinition[]) {
  const trusted = readTrusted()
  return defs.every(d => {
    const url = maybePluginUrl(d)
    return url !== undefined && trusted.has(url)
  })
}

// The plugin URLs currently trusted on this origin, for the UI that revokes
// them. Sorted so the list doesn't reshuffle as approvals accumulate.
export function listTrustedPlugins() {
  return [...readTrusted()].sort((a, b) => a.localeCompare(b))
}

// Revokes every remembered plugin approval on this origin.
export function forgetTrustedPlugins() {
  localStorageRemoveItem(STORAGE_KEY)
}
