import React from 'react'
import {
  AppBar,
  Dialog,
  Paper,
  Toolbar,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { Instance, getEnv } from 'mobx-state-tree'
import createSessionModel from '../createModel/createSessionModel'

type Session = Instance<ReturnType<typeof createSessionModel>>

const useStyles = makeStyles({
  paper: {
    overflow: 'auto',
  },
})

const ModalWidgetContents = observer(({ session }: { session: Session }) => {
  const { visibleWidget } = session
  if (!visibleWidget) {
    return (
      <AppBar position="relative">
        <Toolbar />
      </AppBar>
    )
  }
  const { ReactComponent, HeadingComponent, heading } = getEnv(
    session,
  ).pluginManager.getWidgetType(visibleWidget.type)
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
      {visibleWidget && ReactComponent ? (
        <ReactComponent
          model={visibleWidget}
          session={session}
          overrideDimensions={{
            height: (window.innerHeight * 5) / 8,
            width: 800,
          }}
        />
      ) : null}
    </>
  )
})

const ModalWidget = observer(({ session }: { session: Session }) => {
  const classes = useStyles()
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
