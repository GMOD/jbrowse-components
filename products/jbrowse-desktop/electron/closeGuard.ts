import { ipcHandle, ipcSend } from './ipc/channels.ts'

/**
 * Holds the window open long enough for the renderer to write the session.
 *
 * The autosave runs on a 1s debounce, so closing the window within a second of
 * an edit lost it — usually the last thing you did, which is the visible half:
 * add a track, close, reopen, no track. The in-app Exit and "Return to start
 * screen" menu items already flush for exactly this reason; the title-bar
 * close, Cmd+W and the macOS app-menu Quit did not, because they never go
 * through the renderer at all.
 *
 * The shape here is dictated by what can go wrong, not by what is tidy:
 *
 * - **Gated only when there is something to lose.** The renderer reports
 *   whether a session is open. On the start screen, or before the app has
 *   finished loading, `close` is not held at all — which is what keeps a
 *   half-started or wedged app from becoming unquittable.
 * - **Held once.** A second close attempt always closes. If the renderer never
 *   answers, clicking the X again gets you out, with no timer deciding how long
 *   "too long" is.
 * - **A dead renderer un-gates itself.** render-process-gone and unresponsive
 *   both clear the flag: neither can flush, and the worst case is the behavior
 *   we had before this existed.
 * - **Quit stays quit.** `app.quit()` closes the window, so a naive hold turns
 *   macOS's Quit into "close the window and keep running". Tracking that a quit
 *   is in progress and re-issuing it after the flush is what prevents that —
 *   for an update install as much as for a Quit, which is why the tracking
 *   watches two events; see subscribeQuitSignals.
 */
export interface CloseGuard {
  /**
   * attach to the main window once it exists
   */
  register: (window: Electron.BrowserWindow) => void
  /**
   * Whether the renderer currently has a session it would lose.
   *
   * Read by ensureWindow to decide whether an incoming launch target can be
   * handed to the live renderer or has to navigate the window. It is the same
   * question the close hold asks, answered by the same renderer report, so it
   * inherits the same safety properties: a renderer that has died or gone
   * unresponsive reads as false, which routes the launch back to the navigating
   * path rather than pushing at something that cannot answer.
   */
  readonly sessionOpen: boolean
}

// An emitter this module only ever attaches one kind of listener to. Structural
// so subscribeQuitSignals can be driven by a test without an Electron runtime.
interface QuitSignalSource<E extends string> {
  on: (event: E, listener: () => void) => unknown
}

/**
 * Every signal that means a quit is under way, for the guard's `onQuitting`.
 *
 * Two of them, not one. `app.quit()` emits `before-quit` and *then* closes the
 * windows, which is the ordinary Quit. `autoUpdater.quitAndInstall()` closes
 * them without emitting it — Electron documents exactly that on the event
 * below — so a guard watching only `before-quit` holds that close, flushes,
 * destroys the window and never re-issues the quit. On macOS the install is
 * what that quit was going to do, so the update then silently does not install:
 * a failure nobody would report as a bug.
 *
 * Electron's own `autoUpdater` is the emitter on every platform. electron-
 * updater drives Squirrel through it on macOS, and emits the event on it itself
 * (BaseUpdater.quitAndInstall) on Windows and Linux — where the installer is
 * already spawned by then and waits for the app either way, so the extra flush
 * costs the update nothing.
 */
export function subscribeQuitSignals(
  app: QuitSignalSource<'before-quit'>,
  nativeAutoUpdater: QuitSignalSource<'before-quit-for-update'>,
) {
  return (listener: () => void) => {
    app.on('before-quit', listener)
    nativeAutoUpdater.on('before-quit-for-update', listener)
  }
}

export function createCloseGuard({
  onQuitting,
  quitApp,
}: {
  /**
   * subscribe to the quit signals (see subscribeQuitSignals); called with the
   * unsubscribe-free listener
   */
  onQuitting: (listener: () => void) => void
  /**
   * re-issue the quit the held close interrupted
   */
  quitApp: () => void
}): CloseGuard {
  let sessionOpen = false
  let quitting = false
  // the window whose close is being held, or null when nothing is pending
  let holding: Electron.BrowserWindow | null = null

  onQuitting(() => {
    quitting = true
  })

  ipcHandle('setSessionOpen', (_, open) => {
    sessionOpen = open
  })

  ipcHandle('sessionFlushed', () => {
    const window = holding
    holding = null
    if (window && !window.isDestroyed()) {
      // destroy, not close: close would re-enter the handler below, and the
      // session has already been written
      window.destroy()
    }
    if (quitting) {
      // the quit that this close was part of was cancelled by holding it, so
      // it has to be asked for again
      quitApp()
    }
  })

  return {
    get sessionOpen() {
      return sessionOpen
    },
    register(window) {
      const release = () => {
        // whatever the renderer's last word was, it cannot flush now
        sessionOpen = false
        holding = null
      }
      window.webContents.on('render-process-gone', release)
      window.webContents.on('unresponsive', release)
      window.on('closed', release)

      window.on('close', event => {
        // holding !== null means this is the second attempt on a close the
        // renderer never answered: let it through
        if (sessionOpen && !holding) {
          event.preventDefault()
          holding = window
          ipcSend(window.webContents, 'flushSessionForClose')
        }
      })
    },
  }
}
