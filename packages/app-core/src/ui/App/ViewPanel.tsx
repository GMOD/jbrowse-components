import { Suspense } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewModel,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util'

type AppSession = SessionWithDrawerWidgets & {
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
}

const ViewPanel = observer(function ({
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
      ) : (
        false
      )}
    </ViewContainer>
  )
})

export default ViewPanel
