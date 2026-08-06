import { Suspense } from 'react'

// ui elements
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const ViewWrapper = observer(function ViewWrapper({
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

export default ViewWrapper
