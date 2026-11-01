import { Suspense } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// `removeActiveDialog` is BaseSession's, which every product session composes,
// though `AbstractSessionModel` does not declare it
type DialogQueueSession = AbstractSessionModel & {
  removeActiveDialog: () => void
}

/**
 * The session's dialog, and the boundary that keeps a dialog that throws from
 * being an application-wide failure.
 *
 * `core/ui/Dialog` already wraps its own CHILDREN, which covers a dialog body
 * that throws. It cannot cover the dialog component's own render, and that is
 * where the reachable case is: a launch dialog resolves its source with
 * `getSession` / `getContainingView` off a track, and "Replace current view"
 * destroys the view that track lives in. This queue renders under `App`, above
 * every per-view boundary, so without this the next one up is the product's —
 * jbrowse-web's fatal-error dialog, which takes every view the user had open.
 * ADR-069, and `cancer_sv/multihop_split_view` is the figure it took.
 *
 * Reset on the queue entry, so the queue advancing clears a banner belonging to
 * the dialog before it, including one of the same component.
 */
const DialogQueue = observer(function DialogQueue({
  session,
}: {
  session: DialogQueueSession
}) {
  const { DialogComponent, DialogProps } = session
  return DialogComponent ? (
    <ErrorBoundary
      resetKeys={[DialogComponent, DialogProps]}
      FallbackComponent={({ error }) => (
        <Dialog
          open
          title="Error"
          onClose={() => {
            session.removeActiveDialog()
          }}
        >
          <DialogContent>
            <ErrorMessage error={error} />
          </DialogContent>
        </Dialog>
      )}
    >
      <Suspense fallback={null}>
        <DialogComponent {...DialogProps} />
      </Suspense>
    </ErrorBoundary>
  ) : null
})

export default DialogQueue
