import { Suspense } from 'react'

import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv, useWidthSetter } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { IDockviewPanelProps } from 'dockview-react'
import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  container: {
    height: '100%',
    overflow: 'auto',
    background: theme.palette.background.default,
  },
  content: {
    padding: theme.spacing(1),
  },
}))

interface JBrowseViewPanelParams {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}

const JBrowseViewPanel = observer(function JBrowseViewPanel({
  params,
}: IDockviewPanelProps<JBrowseViewPanelParams>) {
  const { view, session } = params
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)

  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }

  const { ReactComponent } = viewType

  return (
    <Paper ref={ref} elevation={0} className={classes.container}>
      <div className={classes.content}>
        {!view.minimized ? (
          <ErrorBoundary
            FallbackComponent={({ error }) => <ErrorMessage error={error} />}
          >
            <Suspense fallback={<LoadingEllipses variant="h6" />}>
              <ReactComponent model={view} session={session} />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </div>
    </Paper>
  )
})

export default JBrowseViewPanel
