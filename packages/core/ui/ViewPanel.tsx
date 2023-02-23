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
} from '../util'

// ui elements
import ErrorMessage from './ErrorMessage'
import LoadingEllipses from './LoadingEllipses'
import ViewContainer from './ViewContainer'
import { MenuItem as JBMenuItem } from './Menu'

type SnackbarMessage = [string, NotificationLevel, SnackAction]

type AppSession = SessionWithDrawerWidgets & {
  savedSessionNames: string[]
  menus: { label: string; menuItems: JBMenuItem[] }[]
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
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
