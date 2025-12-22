import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer'
import { isSessionWithDockviewLayout } from '../../DockviewLayout'

import type { DockviewSessionType } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IDockviewPanelProps } from 'dockview-react'

const ViewLauncher = lazy(() => import('./ViewLauncher'))

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    overflowY: 'auto',
    background: theme.palette.background.default,
  },
  viewStack: {
    display: 'flex',
    flexDirection: 'column',
  },
  spacer: {
    height: 300,
  },
  emptyPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
}))

export interface JBrowseViewPanelParams {
  panelId: string
  session?: DockviewSessionType
}

function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType | undefined,
): AbstractViewModel[] {
  if (!session || !isSessionWithDockviewLayout(session)) {
    return []
  }
  const viewIds = session.getViewIdsForPanel(panelId)
  return [...viewIds]
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { panelId, session } = params
  const { classes } = useStyles()

  if (!session) {
    return <div className={classes.container}>Loading...</div>
  }

  const views = getViewsForPanel(panelId, session)

  if (views.length === 0) {
    return (
      <div className={classes.container}>
        <div className={classes.emptyPanel}>
          <Suspense fallback={null}>
            <ViewLauncher session={session} />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.container}>
      <div className={classes.viewStack}>
        {views.map(view => (
          <ViewContainer key={view.id} view={view} session={session} />
        ))}
        <div className={classes.spacer} />
      </div>
    </div>
  )
})

export default JBrowseViewPanel
