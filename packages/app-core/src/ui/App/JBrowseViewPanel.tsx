import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ViewContainer from './ViewContainer.tsx'
import { getViewsForPanel } from './dockviewUtils.ts'

import type { DockviewSessionType } from './types.ts'
import type { IDockviewPanelProps } from 'dockview-react'

const ViewLauncher = lazy(() => import('./ViewLauncher.tsx'))

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
