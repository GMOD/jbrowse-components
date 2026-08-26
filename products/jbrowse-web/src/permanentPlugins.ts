import {
  readAllQueryParams,
  readQueryParams,
  setQueryParams,
} from '@jbrowse/app-core'
import {
  maybePluginUrl,
  pluginLabel,
  samePlugin,
  storePluginName,
} from '@jbrowse/core/pluginDefinitions'
import {
  localStorageGetItem,
  localStorageGetJSON,
  localStorageGetStringArray,
  localStorageRemoveItem,
  localStorageSetItem,
  localStorageSetJSON,
} from '@jbrowse/core/util'

import { configBaseUri, resolveConfigPath } from './resolveConfigPath.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

// Plugins the user installs once and gets on every visit to this JBrowse,
// stored in the browser rather than in a config nobody but an admin can edit.
// The config's `plugins[]` is already the install-once answer for whoever runs
// the deployment; this is the answer for everyone else, and for jbrowse.org's
// own builds, which have no admin at all.
//
// Desktop's equivalent is the global plugin list
// (`components/StartScreen/globalPlugins.ts`), and the crash machine below is
// its lesson rather than a new idea. What differs is scope: Desktop has one
// user, one app and one list, while a browser origin holds many JBrowses.

const LIST_PREFIX = 'jbrowse-permanent-plugins:'
const MARKER_PREFIX = 'jbrowse-plugin-load-marker:'
const SAFE_MODE_PARAM = 'safeMode'

/**
 * Which JBrowse a list belongs to: the config url this page resolves to, the
 * same way {@link resolveConfigPath} resolves it for the fetch.
 *
 * NOT the origin, which is what localStorage partitions by and what the trust
 * store (`trustedPlugins.ts`) is content to key on. jbrowse.org serves
 * `/code/jb2/main/`, `/code/jb2/latest/`, every pinned version and every
 * `demos/*` config from one origin, so an origin-keyed list would load a plugin
 * installed against one build into all of them — including builds at a plugin
 * ABI it was never compiled for.
 *
 * NOT the raw `?config=` either. A page with no param at all has nothing to key
 * on, and a relative `test_data/volvox/config.json` names a different file under
 * each app path while spelling the same string. Resolving both of those against
 * the page url is what separates them, and it also lets a relative and an
 * absolute spelling of one config find the same list.
 *
 * The rest of the query is deliberately not in here. `session=`/`loc=`/`hubURL=`
 * differ per link, so folding them in would mean a list that is never found
 * twice, and `adminKey`/`password` must not be written into a storage key at
 * all.
 */
function configKey() {
  return configBaseUri(resolveConfigPath(readQueryParams(['config']).config))
    .href
}

function listKey() {
  return `${LIST_PREFIX}${configKey()}`
}

function markerKey() {
  return `${MARKER_PREFIX}${configKey()}`
}

/**
 * An entry in the list: a plugin definition, plus whether the user has switched
 * it off.
 *
 * The flag rides on the definition rather than wrapping it, so the stored value
 * stays the list of definitions it has always been and an entry written by an
 * older build needs no migration — no flag means enabled. Everything downstream
 * (`samePlugin`, PluginLoader) ignores fields it doesn't know.
 */
export type PermanentPluginEntry = PluginDefinition & { disabled?: boolean }

function isEntry(value: unknown): value is PermanentPluginEntry {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const definition = value as PluginDefinition
  return (
    maybePluginUrl(definition) !== undefined ||
    storePluginName(definition) !== undefined
  )
}

/**
 * The whole list for this config, including the entries switched off, since
 * this is what the dialog edits.
 *
 * An entry that names neither a url nor a store entry is dropped rather than
 * kept: nothing can load it, and `samePlugin` matches nothing against it, so it
 * could only accumulate as a row nothing is able to remove. A bare store ref is
 * kept — `resolveStorePluginRefs` turns it into a build at load time, which is
 * the form that survives this JBrowse being upgraded under the list.
 *
 * Desktop splits this into two read paths, one of which propagates a read
 * failure so an editing surface can't save `[]` over a list it merely failed to
 * fetch. That split does not carry over: a browser that refuses to read
 * localStorage refuses to write it too, so there is no state where this returns
 * empty and the write that follows lands.
 */
export function readPermanentPlugins(): PermanentPluginEntry[] {
  const stored = localStorageGetJSON<unknown>(listKey(), [])
  return Array.isArray(stored) ? stored.filter(isEntry) : []
}

export function setPermanentPlugins(entries: PermanentPluginEntry[]) {
  localStorageSetJSON(listKey(), entries)
  notifyPermanentPluginsChanged()
}

/**
 * Adds a definition, if the list doesn't already describe that plugin.
 *
 * `samePlugin` rather than an equality check, so installing a newer build of
 * something already in the list is not a second copy of it under one UMD name —
 * `PluginManager.addPlugin` would refuse the duplicate on the next load and the
 * list would keep growing.
 */
export function addPermanentPlugin(definition: PluginDefinition) {
  const list = readPermanentPlugins()
  setPermanentPlugins([
    ...list.filter(p => !samePlugin(p, definition)),
    definition,
  ])
}

export function removePermanentPlugin(definition: PluginDefinition) {
  setPermanentPlugins(
    readPermanentPlugins().filter(p => !samePlugin(p, definition)),
  )
}

/**
 * Switch an entry off, or back on. Enabling drops the key rather than writing
 * `false`, so a list toggled twice is the value one never touched.
 */
export function setPermanentPluginDisabled(
  definition: PluginDefinition,
  disabled: boolean,
) {
  setPermanentPlugins(
    readPermanentPlugins().map(entry => {
      if (!samePlugin(entry, definition)) {
        return entry
      }
      const next = { ...entry }
      if (disabled) {
        next.disabled = true
      } else {
        delete next.disabled
      }
      return next
    }),
  )
}

export function clearPermanentPlugins() {
  localStorageRemoveItem(listKey())
  notifyPermanentPluginsChanged()
}

// The dialog re-reads the list after its own writes rather than observing it —
// localStorage is not MST state and nothing here is reactive. This is how it is
// told, and it is a plain callback set because there is exactly one subscriber:
// a `storage` listener would be the general form, and it reports another tab's
// writes but never this one's, which is the half that matters here.
const changeListeners = new Set<() => void>()

export function onPermanentPluginsChanged(fn: () => void) {
  changeListeners.add(fn)
  return () => {
    changeListeners.delete(fn)
  }
}

function notifyPermanentPluginsChanged() {
  for (const fn of [...changeListeners]) {
    fn()
  }
}

export type SafeModeReason = 'requested' | 'previousLaunchFailed'

function readSafeModeReason(): SafeModeReason | undefined {
  // has(), not a value read: a bare `?safeMode` is the natural way to write
  // this by hand and reads back as the empty string, which is falsy. Through
  // app-core rather than window.location.search, because a jbrowse-web url
  // whose params live in the hash keeps this one there too.
  return readAllQueryParams().has(SAFE_MODE_PARAM)
    ? 'requested'
    : localStorageGetItem(markerKey())
      ? 'previousLaunchFailed'
      : undefined
}

// Read once, at module load: the marker is cleared during a successful boot, so
// asking later would answer a different question than the one callers mean.
const safeModeReason = readSafeModeReason()
const safeModeSuspects =
  safeModeReason === 'previousLaunchFailed'
    ? localStorageGetStringArray(markerKey())
    : []

/**
 * Why the permanent plugins are being skipped this load, or undefined when they
 * are loading normally.
 */
export function permanentPluginSafeMode() {
  return safeModeReason
}

/**
 * The plugins that were loading when the previous attempt failed to finish, when
 * that is why they are off. Empty otherwise — including under `?safeMode`, where
 * nothing failed and there is nothing to accuse.
 */
export function permanentPluginSafeModeSuspects() {
  return safeModeSuspects
}

/**
 * The definitions to load: the enabled entries, none in safe mode.
 *
 * Also where the crash marker is armed, because a plugin that throws while its
 * module is evaluated, hangs, or takes the tab down leaves no error anyone can
 * act on — the next load finding this marker set is how it learns that the last
 * one never finished.
 */
export function getPermanentPlugins(): PluginDefinition[] {
  if (safeModeReason) {
    return []
  }
  const plugins = readPermanentPlugins().filter(p => !p.disabled)
  // Armed after the read, and only when there is something to suspect. Arming
  // it unconditionally would tell a user who has never installed one that
  // permanent plugins failed to load, after any unrelated crash during session
  // load, and put them in a safe mode that skips an empty list and so changes
  // nothing about the crash they are about to hit again. A list that is all
  // switched off counts as empty for the same reason: none of them ran.
  //
  // The value is the labels of what was about to load, so the load after a
  // crash can name them. That is the difference between a banner the user can
  // act on and one that only says something went wrong.
  if (plugins.length > 0) {
    localStorageSetItem(
      markerKey(),
      JSON.stringify(plugins.map(p => pluginLabel(p))),
    )
  }
  return plugins
}

/**
 * Called once a plugin manager has been built: whatever the permanent plugins
 * were going to do to this load, they have done it.
 */
export function markPermanentPluginLoadSucceeded() {
  // Not in safe mode, where none of them ran and so nothing has been vouched
  // for. Clearing it there re-arms them for the next load, which reproduces the
  // crash that set the marker: the app works every *other* time it is opened.
  if (!safeModeReason) {
    localStorageRemoveItem(markerKey())
  }
}

/**
 * Reload skipping the permanent plugins — the escape hatch from one that
 * crashes the app, offered from the fatal error dialog, which is the only
 * surface left when the crash comes before the menus.
 *
 * Deliberately not a delete: it leaves the list intact so the user can take out
 * the culprit and keep the rest.
 */
export function reloadInSafeMode() {
  setQueryParams({ [SAFE_MODE_PARAM]: '1' })
  window.location.reload()
}

/**
 * Reload with the permanent plugins back on, clearing the crash marker that
 * turned safe mode on by itself.
 */
export function reloadWithPermanentPlugins() {
  setQueryParams({ [SAFE_MODE_PARAM]: undefined })
  localStorageRemoveItem(markerKey())
  window.location.reload()
}
