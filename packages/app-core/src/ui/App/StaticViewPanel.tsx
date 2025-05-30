import { Suspense } from 'react'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { observer } from 'mobx-react'

// locals
import {
  getEnv,
  AbstractViewModel,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util'
import { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'

// ui elements
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'

// locals
import ViewContainer from './ViewContainer'

type AppSession = SessionWithDrawerWidgets & {
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
}

const StaticViewPanel = observer(function StaticViewPanel2({
  view,
  session,
}: {
  view: AbstractViewModel
  session: AppSession
}) {
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  return (
    <ViewContainer
      // @ts-expect-error
      session={session}
      view={view}
      onClose={() => {
        session.removeView(view)
      }}
      onMinimize={() => {
        view.setMinimized(!view.minimized)
      }}
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
