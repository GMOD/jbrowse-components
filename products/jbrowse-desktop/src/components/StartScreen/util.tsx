import { destroy, isAlive } from '@jbrowse/mobx-state-tree'

import type { DesktopRootModel } from '../../rootModel/rootModel.ts'
import type { StartScreenPluginManager } from './pluginManagers.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'

export { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
// re-exported so callers (e.g. LeftSidePanel) keep one import site
export { fetchConfig } from './fetchConfig.ts'
export type { StartScreenPluginManager } from './pluginManagers.tsx'

/**
 * The three ways a plugin manager gets built, each behind a dynamic import.
 *
 * pluginManagers.tsx reaches corePlugins, and through it every plugin's models,
 * adapters and config schemas — the renderer's entire plugin graph, plus the
 * root and session models. Until this split it was the one static path from the
 * app's entry to all of that, so launching JBrowse Desktop meant parsing and
 * evaluating the whole thing before the start screen could draw a single pixel,
 * even though the start screen has no session and uses none of it.
 *
 * All three entry points were already async and awaited at every call site, so
 * deferring them costs a chunk load on a path that was going to wait on IPC and
 * plugin fetches anyway. Nothing here may import pluginManagers.tsx statically —
 * one such import puts the graph back in the first paint, and nothing about the
 * diff would say so. `pnpm build` is where that shows up: the plugin chunk must
 * not be among index.html's own <script> tags.
 */

export async function createStartScreenPluginManager(): Promise<StartScreenPluginManager> {
  const { createStartScreenPluginManager } =
    await import('./pluginManagers.tsx')
  return createStartScreenPluginManager()
}

export async function loadPluginManager(configPath: string) {
  const { loadPluginManager } = await import('./pluginManagers.tsx')
  return loadPluginManager(configPath)
}

export async function openSpecLink(link: string) {
  const { openSpecLink } = await import('./pluginManagers.tsx')
  return openSpecLink(link)
}

/**
 * Tear down a plugin manager that is being replaced: terminate its RPC worker
 * threads and destroy the root model so its autorun disposers (e.g. autosave)
 * fire. Without this, every session switch / plugin reload orphans the previous
 * worker pool and leaves a live autosave loop holding the old tree.
 *
 * Stays here rather than in pluginManagers.tsx, and stays synchronous: the
 * Loader calls it while replacing its own state, and it needs nothing from the
 * plugin graph — only a live root model, which by definition already exists.
 */
export function destroyPluginManager(pluginManager: PluginManager) {
  const rootModel = pluginManager.rootModel as DesktopRootModel | undefined
  if (rootModel && isAlive(rootModel)) {
    rootModel.rpcManager.destroy()
    destroy(rootModel)
  }
}
