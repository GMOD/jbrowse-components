import { resolvedPluginUrl } from '@jbrowse/core/pluginDefinitions'
import {
  localStorageGetStringArray,
  localStorageRemoveItem,
  localStorageSetJSON,
} from '@jbrowse/core/util'

import { checkPlugins } from './util.ts'

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
// Keyed by the resolved url, since a relative one names a different file in
// every config that lists it. A definition naming no loader records nothing:
// pluginUrl's miss value is the display string 'unknown url', and writing that
// into the trust set marked every *other* unloadable definition as approved.
export function rememberPlugins(defs: PluginDefinition[]) {
  const trusted = readTrusted()
  for (const d of defs) {
    const url = resolvedPluginUrl(d)
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
    const url = resolvedPluginUrl(d)
    return url !== undefined && trusted.has(url)
  })
}

/**
 * Whether the plugins may load without asking: remembered here, or vouched for
 * by checkPlugins. The local check goes first because checkPlugins fetches the
 * plugin store and throws when it is unreachable, and an already-remembered
 * plugin must not fail its load because the store is down.
 */
export async function arePluginsTrusted(defs: PluginDefinition[]) {
  return arePluginsRemembered(defs) || checkPlugins(defs)
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLoopback(url: { hostname: string }) {
  return LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost')
}

/**
 * Whether a config's plugins load without the cross-origin prompt: the
 * config comes from this origin, or both this app and the config run on the
 * developer's own machine, such as a dev build on one port reading a plugin
 * build served on another. A link from anywhere else still prompts, since its
 * config is not on loopback.
 */
export function configNeedsNoPrompt(
  configUrl: { origin: string; hostname: string },
  appUrl: { origin: string; hostname: string },
) {
  return (
    configUrl.origin === appUrl.origin ||
    (isLoopback(configUrl) && isLoopback(appUrl))
  )
}

// Revokes every remembered plugin approval on this origin. No UI reaches this —
// the set is only ever read by the gate above — so it is the tests' reset.
export function forgetTrustedPlugins() {
  localStorageRemoveItem(STORAGE_KEY)
}
