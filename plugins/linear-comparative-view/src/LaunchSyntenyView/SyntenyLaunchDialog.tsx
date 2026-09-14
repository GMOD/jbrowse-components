import { SubmitDialog, replaceViewAction } from '@jbrowse/core/ui'

import type {
  AbstractViewContainer,
  NotificationSink,
  AbstractViewModel,
} from '@jbrowse/core/util'
import type { ReactNode } from 'react'

/**
 * The shell both synteny launch dialogs are: a form whose two ways out are
 * "open in a new view" and "replace the view this came from", and which closes
 * once the launch has happened.
 *
 * The two ways out are one callback, not two. `replaceViewAction` decides
 * whether the session can honor a replacement at all (the single-view embedded
 * products cannot), so a dialog that spelled the pair itself had to repeat that
 * question and then repeat its own `launch(replacing)` beside it.
 *
 * `ready` carries the launch's inputs as one value, with no separate boolean
 * beside them. `undefined` greys out both ways out, and anything else is handed
 * back to `onLaunch` already narrowed. A dialog
 * spelling the condition twice — once to disable the button and once to guard
 * the handler — is how the two drift.
 *
 * BUILDING THE VIEW CAN FAIL, after the click. `launchSyntenyView` rejects a
 * spec that resolves to fewer than two panels, and an unhandled throw out of an
 * onClick takes the dialog with it and reports nothing. The dialog catches the
 * throw, shows it as a notification and stays open on the choices that produced
 * it.
 */
export default function SyntenyLaunchDialog<T>({
  session,
  sourceView,
  title,
  ready,
  onLaunch,
  handleClose,
  children,
}: {
  session: AbstractViewContainer & NotificationSink
  // the launching view, which the dialog offers to put the result in place of.
  // Optional for a caller with no single view to name; a caller that has one
  // passes it unconditionally, since replaceViewAction is what decides whether
  // the session can honor it
  sourceView?: AbstractViewModel
  title: string
  // the launch's inputs once they are all valid, or undefined while they aren't
  ready: T | undefined
  // `replacing` is the view to put the result in place of, or nothing for a new
  // view
  onLaunch: (ready: T, replacing?: AbstractViewModel) => void
  handleClose: () => void
  children: ReactNode
}) {
  const launchDisabled = ready === undefined
  const launch = (replacing?: AbstractViewModel) => {
    if (ready === undefined) {
      return
    }
    try {
      onLaunch(ready, replacing)
      handleClose()
    } catch (e) {
      console.error(e)
      session.notifyError(`${e}`, e)
    }
  }
  return (
    <SubmitDialog
      {...replaceViewAction({
        session,
        sourceView,
        disabled: launchDisabled,
        onReplace: launch,
      })}
      open
      title={title}
      submitDisabled={launchDisabled}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        launch()
      }}
    >
      {children}
    </SubmitDialog>
  )
}
