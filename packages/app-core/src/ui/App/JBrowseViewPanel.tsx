import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { useDockview } from './DockviewContext.tsx'
import ViewStack from './ViewStack.tsx'
import { getViewsForPanel } from './dockviewUtils.ts'

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
  emptyPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
}))

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  api,
}: IDockviewPanelProps) {
  // Panel identity is the dockview panel id: it is the one thing every layout
  // ever persisted carries, however its params were shaped at the time.
  const panelId = api.id
  const { session } = useDockview()
  const { classes } = useStyles()

  // session is always provided by TiledViewsContainer's DockviewContext; the
  // guard only satisfies the optional default-context type.
  if (!session) {
    return null
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
        <ViewStack views={views} session={session} />
      </div>
    </div>
  )
})

export default JBrowseViewPanel
