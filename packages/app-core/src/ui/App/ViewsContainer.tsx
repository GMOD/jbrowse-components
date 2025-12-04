import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import StaticViewPanel from './StaticViewPanel'

import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

const FloatingViewPanel = lazy(() => import('./FloatingViewPanel'))
const ViewLauncher = lazy(() => import('./ViewLauncher'))

const useStyles = makeStyles()({
  viewsContainer: {
    overflowY: 'auto',
    gridRow: 'components',
  },
})

interface Props {
  HeaderButtons?: React.ReactElement
  session: SessionWithFocusedViewAndDrawerWidgets & {
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
        views.map(view =>
          view.isFloating ? (
            <Suspense key={`view-${view.id}`} fallback={null}>
              <FloatingViewPanel view={view} session={session} />
            </Suspense>
          ) : (
            <StaticViewPanel
              key={`view-${view.id}`}
              view={view}
              session={session}
            />
          ),
        )
      ) : (
        <Suspense fallback={null}>
          <ViewLauncher {...props} />
        </Suspense>
      )}

      {/* blank space at the bottom of screen allows scroll */}
      <div style={{ height: 300 }} />
    </div>
  )
})

export default ViewsContainer
