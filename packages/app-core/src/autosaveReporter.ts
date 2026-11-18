import type { NotificationSink } from '@jbrowse/core/util/types'

type Notifier = Pick<NotificationSink, 'notify' | 'notifyError'>

/**
 * Reports an autosave's failures to the user without stacking a toast per
 * failing tick: the first failure is reported, later ones stay quiet until a
 * save succeeds, and that success says once that saving works again. An
 * autosave autorun re-runs on every change, and `notifyError` always pushes a
 * fresh snackbar, so a failure that persists would otherwise pile up identical
 * error toasts. One reporter per autosave, whichever session each tick saves.
 */
export function createAutosaveReporter() {
  let failing = false
  return {
    failed(session: Notifier, error: unknown, message = `${error}`) {
      if (!failing) {
        failing = true
        session.notifyError(message, error)
      }
    },
    saved(session: Notifier) {
      if (failing) {
        failing = false
        session.notify('Auto-saving restored', 'info')
      }
    },
  }
}
