import { ErrorBanner } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { viewTitle } from './viewTitle.ts'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  which: {
    padding: `${theme.spacing(1)} ${theme.spacing(1)} 0`,
  },
}))

// The fallback must not be able to throw. What crashes a view is often one of
// its own getters, and `viewTitle` reads `assemblyNames`, which is one — so
// naming the view is exactly where a fallback can rethrow, and a rethrow here
// goes to the app boundary and puts up FatalErrorDialog, i.e. the whole-page
// failure this boundary exists to avoid. `displayName` and `type` are plain
// properties and cannot.
function safeViewTitle(
  view: AbstractViewModel,
  session: SessionWithFocusedViewAndDrawerWidgets,
) {
  try {
    return viewTitle(view, r => session.assemblyManager.getDisplayName(r))
  } catch {
    return view.displayName ?? 'Untitled view'
  }
}

/**
 * What a view that threw during render is replaced by: which view died, the
 * error itself, and the two ways out that are not reloading the application.
 *
 * Retry clears the boundary and remounts the view component — worth offering
 * because a good share of these are transient (a lazy chunk that failed to
 * fetch, a GPU context lost). Close goes through the session's `removeView`,
 * which detaches before it destroys; nothing here may destroy the node itself
 * (ADR-069).
 */
const ViewErrorFallback = observer(function ViewErrorFallback({
  view,
  session,
  error,
  onRetry,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
  error: unknown
  onRetry: () => void
}) {
  const { classes } = useStyles()
  return (
    <div>
      <div className={classes.which}>
        {`The ${view.type} "${safeViewTitle(view, session)}" could not be displayed`}
      </div>
      <ErrorBanner
        error={error}
        onReset={onRetry}
        extraAction={
          <Button
            data-testid="close_crashed_view"
            onClick={() => {
              session.removeView(view)
            }}
          >
            Close view
          </Button>
        }
      />
    </div>
  )
})

export default ViewErrorFallback
