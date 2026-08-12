import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'

import { invokeIpc } from '../../ipc.ts'
import { setQueryParams } from '../../useQueryParam.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const SAFE_MODE_PARAM = 'safeMode'

// Written once the global plugin list is known to be non-empty, and cleared
// once a plugin manager has been built with it. Finding it already set at
// startup means the last attempt never got that far — a plugin that threw while
// its module was evaluated, hung, or took the renderer down with it — and none
// of those leave an error anyone can act on, so the next launch skips global
// plugins instead of reproducing the same crash. Cleared, rather than removed,
// because the core localStorage helpers only get and set.
const LOADING_MARKER = 'jbrowse-desktop-global-plugins-loading'

export type SafeModeReason = 'requested' | 'previousLaunchFailed'

function readSafeModeReason(): SafeModeReason | undefined {
  // has(), not get(): a bare `?safeMode` is a perfectly ordinary way to write
  // this by hand and reads back as the empty string, which is falsy
  return new URLSearchParams(window.location.search).has(SAFE_MODE_PARAM)
    ? 'requested'
    : localStorageGetItem(LOADING_MARKER)
      ? 'previousLaunchFailed'
      : undefined
}

// Read once, at module load: the marker is cleared during a successful boot, so
// asking later would answer a different question than the one callers mean.
const safeModeReason = readSafeModeReason()

/**
 * Why global plugins are being skipped this launch, or undefined when they are
 * loading normally.
 */
export function globalPluginSafeMode() {
  return safeModeReason
}

/**
 * An entry in the user's global plugin list: a plugin definition, plus whether
 * they have switched it off.
 *
 * The flag rides on the definition rather than wrapping it, so the file stays
 * the list of definitions it has always been and an entry written by an older
 * build needs no migration — no flag means enabled. Everything downstream
 * (`samePlugin`, `dedupePlugins`, PluginLoader) ignores fields it doesn't know,
 * and only a disabled entry carries this one at all.
 */
export type GlobalPluginEntry = PluginDefinition & { disabled?: boolean }

/**
 * Switch an entry off, or back on. Enabling drops the key rather than writing
 * `false`, so an untouched list and one that has been toggled twice are the same
 * file.
 */
export function withDisabled(entry: GlobalPluginEntry, disabled: boolean) {
  const next = { ...entry }
  if (disabled) {
    next.disabled = true
  } else {
    delete next.disabled
  }
  return next
}

/**
 * The user's global plugin list, or a failure to read it — every entry,
 * including the disabled ones, since this is what the dialog edits. Editing
 * surfaces use this rather than {@link getGlobalPlugins}: a read that failed
 * must not look like an empty list to something about to write the list back.
 */
export async function readGlobalPlugins() {
  return (await invokeIpc('getGlobalPlugins')) as GlobalPluginEntry[]
}

/**
 * The global plugins to load into a plugin manager: the enabled ones, none in
 * safe mode, and none when the list can't be read — an unreadable or corrupt
 * globalPlugins.json must not take the whole session down with it.
 */
export async function getGlobalPlugins() {
  let plugins: GlobalPluginEntry[] = []
  if (!safeModeReason) {
    try {
      plugins = (await readGlobalPlugins()).filter(p => !p.disabled)
    } catch (e) {
      console.error(e)
    }
    // Armed after the read, and only when there is in fact something to
    // suspect. Arming it unconditionally meant a user who has never installed a
    // global plugin was still told, after any hard crash during session load,
    // that "global plugins were disabled because the last launch did not finish
    // loading them" — and put into a safe mode that skips an empty list and so
    // changes nothing about the crash they are about to hit again. A list whose
    // entries are all switched off counts as empty here for the same reason:
    // none of them ran.
    if (plugins.length > 0) {
      localStorageSetItem(LOADING_MARKER, '1')
    }
  }
  return plugins
}

/**
 * Bumped whenever the list is written. Anything that built something from the
 * list can compare this against the value it built at to tell whether an edit
 * has landed since — see createStartScreenPluginManager, which is built once per
 * launch rather than once per mount.
 */
let generation = 0

export function globalPluginsGeneration() {
  return generation
}

export async function setGlobalPlugins(plugins: GlobalPluginEntry[]) {
  await invokeIpc('setGlobalPlugins', plugins)
  generation++
}

/**
 * Called once a plugin manager has been built: whatever the global plugins were
 * going to do to this launch, they have done it.
 */
export function markGlobalPluginLoadSucceeded() {
  // Not in safe mode, where no global plugin ran and so nothing has been
  // vouched for. Clearing it here re-armed them for the next launch, which
  // reproduced the crash that set the marker in the first place: the app worked
  // every *other* time it was started, and the "Re-enable" the banner offers was
  // the only thing standing between the user and that loop. Safe mode now stays
  // on until they take it off.
  if (!safeModeReason) {
    localStorageSetItem(LOADING_MARKER, '')
  }
}

/**
 * Reload skipping global plugins — the escape hatch from a global plugin that
 * crashes the app, offered anywhere the user can still see a crash (the fatal
 * error dialog, the start screen banner). Deliberately not a file write: it
 * leaves the user's list intact so they can remove the culprit and re-enable
 * the rest.
 */
export function reloadInSafeMode() {
  setQueryParams({ [SAFE_MODE_PARAM]: '1' })
  window.location.reload()
}

/**
 * Reload with global plugins back on, clearing the crash marker that turned
 * safe mode on by itself.
 */
export function reloadWithGlobalPlugins() {
  setQueryParams({ [SAFE_MODE_PARAM]: undefined })
  localStorageSetItem(LOADING_MARKER, '')
  window.location.reload()
}
