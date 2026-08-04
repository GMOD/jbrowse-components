import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'

import { invokeIpc } from '../../ipc.ts'
import { setQueryParams } from '../../useQueryParam.ts'

import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

const SAFE_MODE_PARAM = 'safeMode'

// Written before global plugins are loaded and cleared once a plugin manager
// has been built with them. Finding it already set at startup means the last
// attempt never got that far — a plugin that threw while its module was
// evaluated, hung, or took the renderer down with it — and none of those leave
// an error anyone can act on, so the next launch skips global plugins instead
// of reproducing the same crash. Cleared, rather than removed, because the
// core localStorage helpers only get and set.
const LOADING_MARKER = 'jbrowse-desktop-global-plugins-loading'

export type SafeModeReason = 'requested' | 'previousLaunchFailed'

function readSafeModeReason(): SafeModeReason | undefined {
  return new URLSearchParams(window.location.search).get(SAFE_MODE_PARAM)
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
 * The user's global plugin list, or a failure to read it. Editing surfaces use
 * this rather than {@link getGlobalPlugins}: a read that failed must not look
 * like an empty list to something about to write the list back.
 */
export async function readGlobalPlugins() {
  return (await invokeIpc('getGlobalPlugins')) as PluginDefinition[]
}

/**
 * The global plugins to load into a plugin manager: none in safe mode, and none
 * when the list can't be read — an unreadable or corrupt globalPlugins.json
 * must not take the whole session down with it.
 */
export async function getGlobalPlugins() {
  let plugins: PluginDefinition[] = []
  if (!safeModeReason) {
    localStorageSetItem(LOADING_MARKER, '1')
    try {
      plugins = await readGlobalPlugins()
    } catch (e) {
      console.error(e)
    }
  }
  return plugins
}

export async function setGlobalPlugins(plugins: PluginDefinition[]) {
  await invokeIpc('setGlobalPlugins', plugins)
}

/**
 * Called once a plugin manager has been built: whatever the global plugins were
 * going to do to this launch, they have done it.
 */
export function markGlobalPluginLoadSucceeded() {
  localStorageSetItem(LOADING_MARKER, '')
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
