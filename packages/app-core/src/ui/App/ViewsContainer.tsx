import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

import type { AppSession } from './types.ts'

const ClassicViewsContainer = lazy(() => import('./ClassicViewsContainer.tsx'))
const TiledViewsContainer = lazy(() => import('./TiledViewsContainer.tsx'))
const ViewLauncher = lazy(() => import('./ViewLauncher.tsx'))

const useStyles = makeStyles()({
  viewsContainer: {
    gridRow: 'components',
    overflow: 'hidden',
  },
})

interface Props {
  HeaderButtons?: React.ReactElement
  session: AppSession
}

const ViewsContainer = observer(function ViewsContainer(props: Props) {
  const { session } = props
  const { views, effectiveUseWorkspaces } = session
  const { classes } = useStyles()

  return (
    <div className={classes.viewsContainer}>
      <Suspense fallback={null}>
        {views.length > 0 ? (
          effectiveUseWorkspaces && isSessionWithDockviewLayout(session) ? (
            <TiledViewsContainer session={session} />
          ) : (
            <ClassicViewsContainer session={session} />
          )
        ) : (
          <ViewLauncher session={session} />
        )}
      </Suspense>
    </div>
  )
})

export default ViewsContainer
