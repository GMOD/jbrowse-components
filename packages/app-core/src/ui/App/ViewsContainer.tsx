import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

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
  const { views, useWorkspaces } = session
  const { classes } = useStyles()

  return (
    <div className={classes.viewsContainer}>
      {views.length > 0 ? (
        <Suspense fallback={null}>
          {useWorkspaces ? (
            <TiledViewsContainer session={session} />
          ) : (
            <ClassicViewsContainer session={session} />
          )}
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <ViewLauncher {...props} />
        </Suspense>
      )}
    </div>
  )
})

export default ViewsContainer
