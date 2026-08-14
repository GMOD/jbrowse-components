import { Suspense } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ViewErrorFallback from './ViewErrorFallback.tsx'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

// Separate from the boundary below on purpose: `getViewType` throws when no
// plugin registered the type, and a lookup done in the boundary's own render is
// a lookup the boundary cannot catch. This is the one thing in a view's render
// path that fails without any of the view's own code running.
const ViewComponent = observer(function ViewComponent({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  return (
    <Suspense
      fallback={
        // Marked, for the same reason ViewContainer publishes `data-view-phase`
        // one level up — and this is the state that one cannot see. The view
        // MODEL is fine here; what is missing is its lazily-imported React
        // component, so `data-view-phase` already reads `initialized`, no
        // display has mounted to publish `data-display-phase`, and every
        // readiness signal a capture waits on is silent while the body is a
        // spinner. It shows up when a view type is clicked into existence
        // rather than loaded with the session — its chunk is fetched only then
        // — which is exactly the second frame of a launch-dialog figure.
        <LoadingEllipses variant="h6" data-view-component-pending="true" />
      }
    >
      <ReactComponent model={view} session={session} />
    </Suspense>
  )
})

/**
 * A view's body, and the boundary that keeps a view that throws from being an
 * application-wide failure.
 *
 * Without it the next boundary up is the product's own — jbrowse-web's is in
 * `Loader.tsx` and its fallback is `FatalErrorDialog`, so one bad view replaced
 * every other view the user had open. The reachable case is not hypothetical: a
 * display's reads walk to `getContainingView` and throw when the walk finds no
 * view, which is what ADR-069 is about.
 *
 * No reset keys: a view body unmounts on its own when the view is minimized or
 * scrolls out of the mount band, so remounting is already how a stale banner
 * clears. What the fallback adds is the deliberate ways out — retry, and close.
 */
const ViewWrapper = observer(function ViewWrapper({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <ViewErrorFallback
          view={view}
          session={session}
          error={error}
          onRetry={resetErrorBoundary}
        />
      )}
    >
      <ViewComponent view={view} session={session} />
    </ErrorBoundary>
  )
})

export default ViewWrapper
