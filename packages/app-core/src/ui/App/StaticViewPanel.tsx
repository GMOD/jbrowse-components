import { Suspense } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer'

import type { AppSession } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'

const StaticViewPanel = observer(function ({
  view,
  session,
  contentHeight,
}: {
  view: AbstractViewModel
  session: AppSession
  contentHeight?: number
}) {
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  return (
    <ViewContainer
      session={session}
      view={view}
      onClose={() => {
        session.removeView(view)
      }}
      onMinimize={() => {
        view.setMinimized(!view.minimized)
      }}
      contentHeight={contentHeight}
    >
      {!view.minimized ? (
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorMessage error={error} />}
        >
          <Suspense fallback={<LoadingEllipses variant="h6" />}>
            <ReactComponent model={view} session={session} />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </ViewContainer>
  )
})

export default StaticViewPanel
