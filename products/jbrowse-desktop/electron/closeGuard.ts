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
 *   is in progress and re-issuing it after the flush is what prevents that.
 */
export interface CloseGuard {
  /**
   * attach to the main window once it exists
   */
  register: (window: Electron.BrowserWindow) => void
}

export function createCloseGuard({
  onQuitting,
  quitApp,
}: {
  /**
   * subscribe to app 'before-quit'; called with the unsubscribe-free listener
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
