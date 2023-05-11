import React, { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { observer } from 'mobx-react'

// locals
import {
  getEnv,
  AbstractViewModel,
  NotificationLevel,
  SessionWithDrawerWidgets,
  SnackAction,
} from '@jbrowse/core/util'

// ui elements
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { MenuItem as JBMenuItem } from '@jbrowse/core/ui/Menu'

// locals
import ViewContainer from './ViewContainer'

type SnackbarMessage = [string, NotificationLevel, SnackAction]

type AppSession = SessionWithDrawerWidgets & {
  savedSessionNames: string[]
  menus: { label: string; menuItems: JBMenuItem[] }[]
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
      onClose={() => session.removeView(view)}
      onMinimize={() => view.setMinimized(!view.minimized)}
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
