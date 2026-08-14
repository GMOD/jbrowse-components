import { useRef, useState } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

import { destroyPluginManager } from './StartScreen/util.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Replaces the open session with a freshly loaded one, for every route that does
 * that: a jbrowse:// link or OS open-file pushed from the main process, File ->
 * "Open config.json or .jbrowse file...", File -> Session -> "Open JBrowse Web
 * link...", and the reload after a plugin change.
 *
 * One implementation because the ordering below is the whole of it, and it is
 * not what any of those routes did on their own.
 *
 * **Load, then flush, then install.** Installing destroys the outgoing manager,
 * taking its MST tree with it, and the autosave that would have persisted the
 * last edits runs on a 1s debounce. Every route used to flush *before* starting
 * the load, which covers the debounce as of the click and nothing after it — so
 * everything the user did while a config was being fetched, which is not a fast
 * operation, was still lost. The session stays live and autosaving throughout
 * the load on its own, so the only moment that needs covering is the instant of
 * replacement, and flushing there covers it completely.
 *
 * **A failed load flushes nothing, and that is right.** Nothing has been torn
 * down, so the session that was open is still open, still on screen and still
 * autosaving. The rejection propagates to whoever asked for the swap — a menu
 * item's dialog reports it inline, the pushed route notifies against the session
 * it failed to replace — rather than being turned into a half-built session here.
 *
 * **A superseded swap is destroyed, not installed.** Two launches back to back
 * would otherwise install in whatever order they happened to resolve, leaving
 * the earlier one live and the later one's RPC workers the only ones running.
 * Same job as usePluginManagerLoad's `cancelled` flag, for triggers that are
 * events rather than changed props.
 */
export function useSessionSwap({
  flush,
  onLoad,
}: {
  // persist the open session; called immediately before it is replaced. Must not
  // throw — a flush that failed has already reported itself, and losing the swap
  // to it as well helps nobody.
  flush: () => Promise<void>
  // install the loaded manager, tearing down the one it replaces
  onLoad: (pluginManager: PluginManager) => void
}) {
  const generation = useRef(0)
  const [swapping, setSwapping] = useState(false)

  const swap = useEventCallback(async (load: () => Promise<PluginManager>) => {
    const launch = ++generation.current
    setSwapping(true)
    try {
      const pluginManager = await load()
      // checked again after the flush, not only after the load: the flush is a
      // disk write over IPC, and a swap started during it took the generation
      // while this one was still going to install unconditionally on the far
      // side. Whichever of the two flushes finished last won, so the newer
      // session could be installed and then replaced by the older one it
      // superseded — with the newer manager's tree destroyed as the "previous".
      if (launch === generation.current) {
        await flush()
      }
      if (launch !== generation.current) {
        destroyPluginManager(pluginManager)
        return
      }
      onLoad(pluginManager)
    } finally {
      // only the swap still current clears the flag: a superseded one finishing
      // must not report that the swap behind it is done
      if (launch === generation.current) {
        setSwapping(false)
      }
    }
  })

  // `swapping` is what the Loader runs a progress bar off. The pushed route
  // keeps the open session on screen while it loads, so without it the window
  // shows nothing at all between accepting a link and the session changing
  // underneath — the navigating path it replaced put up a loading screen at once.
  return { swap, swapping }
}
