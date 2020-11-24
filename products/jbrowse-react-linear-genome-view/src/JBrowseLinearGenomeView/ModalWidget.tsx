import AppBar from '@material-ui/core/AppBar'
import Modal from '@material-ui/core/Modal'
import Paper from '@material-ui/core/Paper'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
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
  const { pluginManager, visibleWidget } = session
  if (!visibleWidget) {
    return (
      <AppBar position="static">
        <Toolbar />
      </AppBar>
    )
  }
  const {
    ReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getWidgetType(visibleWidget.type)
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
        <ReactComponent model={visibleWidget} session={session} />
      ) : null}
    </>
  )
})

function ModalWidget({ session }: { session: Session }) {
  const classes = useStyles()
  const { visibleWidget, hideAllWidgets } = session
  return (
    <Modal open={Boolean(visibleWidget)} onClose={hideAllWidgets}>
      <Paper className={classes.paper}>
        <ModalWidgetContents session={session} />
      </Paper>
    </Modal>
  )
}

export default observer(ModalWidget)
