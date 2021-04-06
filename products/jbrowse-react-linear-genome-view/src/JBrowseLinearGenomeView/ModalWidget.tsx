import React, { useState } from 'react'
import {
  AppBar,
  Modal,
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
    position: 'absolute',
    maxWidth: '75vh',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    maxHeight: '75vh',
    overflow: 'auto',
  },
})

const ModalWidgetContents = observer(({ session }: { session: Session }) => {
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const { visibleWidget } = session
  if (!visibleWidget) {
    return (
      <AppBar position="static">
        <Toolbar />
      </AppBar>
    )
  }
  const { ReactComponent, HeadingComponent, heading } = getEnv(
    session,
  ).pluginManager.getWidgetType(visibleWidget.type)
  return (
    <>
      <AppBar
        position="static"
        ref={ref => setToolbarHeight(ref?.getBoundingClientRect().height || 0)}
      >
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
          toolbarHeight={toolbarHeight}
          overrideDimensions={{
            height: (window.innerHeight * 5) / 8,
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
    <Modal open={Boolean(visibleWidget)} onClose={hideAllWidgets}>
      <Paper className={classes.paper}>
        <ModalWidgetContents session={session} />
      </Paper>
    </Modal>
  )
})

export default ModalWidget
