import { useRef, useState } from 'react'

import { useIpc } from '../useIpc.ts'
import { destroyPluginManager } from './StartScreen/util.tsx'

import type { LaunchTarget } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Opens a launch target that arrived while a session was already open — a
 * jbrowse:// link, an OS open-file, a second-instance argv.
 *
 * The main process pushes these here instead of navigating the window to them,
 * and the difference is what this hook is for. A navigation is not a session
 * close, so nothing flushes: the autosave is debounced by a second, and the last
 * thing the user did before clicking the link went with the old page.
 *
 * Loading before flushing, rather than the other way round, is the point of the
 * ordering. The session stays live and autosaving throughout the load, so the
 * only thing at risk is the sub-second debounce window at the instant of
 * replacement — flushing at that instant is what covers it, and flushing before
 * the load instead leaves everything the user does *during* the load (a config
 * fetch is not fast) unsaved when the manager is destroyed. The in-app routes
 * still flush the earlier way; see the note in the Loader.
 *
 * Not flushing at all on a failed load is deliberate too, and free: nothing has
 * been torn down when `load` rejects, so the session that was open is still
 * open, still on screen, and still autosaving. The caller reports the failure
 * against it rather than falling back to the start screen.
 *
 * Returns whether a launch is in flight, so the caller can say so. Without that
 * the window sits on the old session showing nothing at all between the user
 * accepting the link and the swap — the navigating path used to put up a
 * loading screen immediately, and losing that is the one thing the swap is
 * worse at.
 *
 * Every dependency is injected, so the sequencing above is testable without an
 * Electron runtime or the plugin graph behind a real load.
 */
export function useLaunchTarget({
  flush,
  load,
  onLoad,
  onError,
}: {
  // persist the open session; called immediately before it is replaced. Must not
  // throw — a flush that failed has already reported itself, and losing the
  // launch to it as well helps nobody.
  flush: () => Promise<void>
  load: (target: LaunchTarget) => Promise<PluginManager>
  onLoad: (pluginManager: PluginManager) => void
  onError: (error: unknown, target: LaunchTarget) => void
}) {
  // Which launch a resolved manager belongs to, so a superseded one can be torn
  // down instead of installed. Same job as usePluginManagerLoad's `cancelled`
  // flag, for a route where the trigger is a push rather than a changed prop:
  // two links arriving back to back would otherwise install in whatever order
  // they happened to resolve, leaving the earlier one live and its RPC workers
  // the only ones running.
  const generation = useRef(0)
  const [pending, setPending] = useState(false)

  useIpc('openLaunchTarget', target => {
    void (async () => {
      const launch = ++generation.current
      setPending(true)
      try {
        const pluginManager = await load(target)
        if (launch === generation.current) {
          // between the load and the install, so it captures edits made while
          // the load was in flight as well as the ones already there
          await flush()
          onLoad(pluginManager)
        } else {
          destroyPluginManager(pluginManager)
        }
      } catch (e) {
        console.error(e)
        onError(e, target)
      } finally {
        // only the launch still current clears the indicator: a superseded one
        // finishing must not report that the launch behind it is done
        if (launch === generation.current) {
          setPending(false)
        }
      }
    })()
  })

  return pending
}
