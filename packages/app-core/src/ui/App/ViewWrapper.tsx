import React, { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { observer } from 'mobx-react'

// locals
import {
  getEnv,
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

// ui elements
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'

const ViewWrapper = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  if (view.minimized) {
    return null
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => <ErrorMessage error={error} />}
    >
      <Suspense fallback={<LoadingEllipses variant="h6" />}>
        <ReactComponent model={view} session={session} />
      </Suspense>
    </ErrorBoundary>
  )
})

export default ViewWrapper
