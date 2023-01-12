import React, { Suspense } from 'react'
import AppBar from '@mui/material/AppBar'
import Dialog from '@mui/material/Dialog'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { SessionModel } from '../createModel/createSessionModel'

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
  },
})

const ModalWidgetContents = observer(
  ({ session }: { session: SessionModel }) => {
    const { visibleWidget } = session
    if (!visibleWidget) {
      return (
        <AppBar position="relative">
          <Toolbar />
        </AppBar>
      )
    }

    const { pluginManager } = getEnv(session)
    const { ReactComponent, HeadingComponent, heading } =
      pluginManager.getWidgetType(visibleWidget.type)

    const Component = visibleWidget
      ? (pluginManager.evaluateExtensionPoint(
          'Core-replaceWidget',
          ReactComponent,
          {
            session,
            model: visibleWidget,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as React.FC<any>)
      : null

    return (
      <>
        <AppBar position="static">
          <Toolbar>
            {HeadingComponent ? (
              <HeadingComponent model={visibleWidget} />
            ) : (
              <Typography variant="h6">{heading}</Typography>
            )}
          </Toolbar>
        </AppBar>
        {visibleWidget && Component ? (
          <Suspense fallback={<div>Loading...</div>}>
            <ScopedCssBaseline>
              <Component
                model={visibleWidget}
                session={session}
                overrideDimensions={{
                  height: (window.innerHeight * 5) / 8,
                  width: 800,
                }}
              />
            </ScopedCssBaseline>
          </Suspense>
        ) : null}
      </>
    )
  },
)

const ModalWidget = observer(({ session }: { session: SessionModel }) => {
  const { classes } = useStyles()
  const { visibleWidget, hideAllWidgets } = session
  return (
    <Dialog
      open={Boolean(visibleWidget)}
      onClose={hideAllWidgets}
      maxWidth="xl"
    >
      <Paper className={classes.paper}>
        <ModalWidgetContents session={session} />
      </Paper>
    </Dialog>
  )
})

export default ModalWidget
