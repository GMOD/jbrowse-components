import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

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
  session: SessionWithFocusedViewAndDrawerWidgets &
    AbstractViewContainer & {
      renameCurrentSession: (arg: string) => void
      snackbarMessages: SnackbarMessage[]
      popSnackbarMessage: () => unknown
    }
}

const ViewsContainer = observer(function ViewsContainer(props: Props) {
  const { session } = props
  const { views } = session
  const { classes } = useStyles()

  // Check if useWorkspaces property exists and is true (defaults to true if property exists)
  const useWorkspaces =
    'useWorkspaces' in session ? (session.useWorkspaces as boolean) : true

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
