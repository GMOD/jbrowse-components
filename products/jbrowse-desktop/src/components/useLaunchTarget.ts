import { useRef } from 'react'

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
 * close, so nothing flushes: the autosave is debounced by a second, and the
 * last thing the user did before clicking the link went with the old page. The
 * in-app route for the same operation (File -> Session -> "Open JBrowse Web
 * link...") has always flushed first, so the two ways of doing one thing
 * differed only in how much they threw away.
 *
 * Flushing first also makes a failed launch harmless: nothing has been torn
 * down when `load` rejects, so the session that was open is still open and
 * still on screen, and the caller reports the failure against it rather than
 * falling back to the start screen.
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
  // persist the open session before it is replaced; resolves when it is safe to
  // replace. Must not throw — a flush that failed has already reported itself,
  // and losing the launch to it as well helps nobody.
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

  useIpc('openLaunchTarget', target => {
    void (async () => {
      const launch = ++generation.current
      await flush()
      try {
        const pluginManager = await load(target)
        if (launch === generation.current) {
          onLoad(pluginManager)
        } else {
          destroyPluginManager(pluginManager)
        }
      } catch (e) {
        console.error(e)
        onError(e, target)
      }
    })()
  })
}
