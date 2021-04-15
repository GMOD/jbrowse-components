import React, { Suspense } from 'react'
import {
  AppBar,
  Modal,
  Paper,
  Toolbar,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { SessionModel } from '../createModel/createSessionModel'

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

const ModalWidgetContents = observer(
  ({ session }: { session: SessionModel }) => {
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
          <Suspense fallback={<div>Loading...</div>}>
            <ReactComponent model={visibleWidget} session={session} />
          </Suspense>
        ) : null}
      </>
    )
  },
)

export default observer(({ session }: { session: SessionModel }) => {
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
