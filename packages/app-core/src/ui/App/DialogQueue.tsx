import { Suspense } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// `removeActiveDialog` is BaseSession's, and every product session composes it,
// but `AbstractSessionModel` does not declare it — so it is asked for rather
// than assumed. A session without it leaves the fallback's close button doing
// nothing, which is still better than the page it replaces.
function dismissActiveDialog(session: AbstractSessionModel) {
  ;(session as { removeActiveDialog?: () => void }).removeActiveDialog?.()
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
 * Keyed on the component so the queue advancing to a different dialog clears a
 * banner belonging to the one before it.
 */
const DialogQueue = observer(function DialogQueue({
  session,
}: {
  session: AbstractSessionModel
}) {
  const { DialogComponent, DialogProps } = session
  return DialogComponent ? (
    <ErrorBoundary
      resetKeys={[DialogComponent]}
      FallbackComponent={({ error }) => (
        <Dialog
          open
          title="Error"
          onClose={() => {
            dismissActiveDialog(session)
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
