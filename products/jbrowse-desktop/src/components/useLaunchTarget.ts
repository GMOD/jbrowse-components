import { useIpc } from '../useIpc.ts'

import type { LaunchTarget } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Subscribes the session swap to launches the main process pushes here — a
 * jbrowse:// link, an OS open-file, a second-instance argv — instead of
 * navigating the window to them. See ensureWindow in electron.ts for why, and
 * useSessionSwap for what the swap itself guarantees.
 *
 * This is only the subscription: the push is the one trigger with nobody to
 * return a rejection to, so it is also the one that has to report failures
 * itself.
 */
export function useLaunchTarget({
  swap,
  load,
  onError,
}: {
  swap: (load: () => Promise<PluginManager>) => Promise<void>
  load: (target: LaunchTarget) => Promise<PluginManager>
  onError: (error: unknown, target: LaunchTarget) => void
}) {
  useIpc('openLaunchTarget', target => {
    swap(() => load(target)).catch((e: unknown) => {
      console.error(e)
      onError(e, target)
    })
  })
}
