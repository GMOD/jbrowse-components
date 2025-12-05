import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type {
  AbstractViewContainer,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const TiledViewsContainer = lazy(() => import('./TiledViewsContainer'))
const ViewLauncher = lazy(() => import('./ViewLauncher'))

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
  return (
    <div className={classes.viewsContainer}>
      {views.length > 0 ? (
        <Suspense fallback={null}>
          <TiledViewsContainer session={session} />
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
