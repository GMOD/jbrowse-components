import { Suspense } from 'react'

import { Dialog, LoadingEllipses, PluggableComponent } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import CloseIcon from '@mui/icons-material/Close'
import {
  AppBar,
  Box,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
    minWidth: 800,
  },
})

const DrawerAppBar = observer(function DrawerAppBar({
  session,
  onClose,
}: {
  session: SessionWithWidgets
  onClose: () => void
}) {
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  if (!visibleWidget) {
    return null
  }
  const widgetType = pluginManager.getWidgetType(visibleWidget.type)
  if (!widgetType) {
    throw new Error(`unknown widget type ${visibleWidget.type}`)
  }
  const { HeadingComponent, heading } = widgetType

  return (
    <AppBar position="static">
      <Toolbar>
        {HeadingComponent ? (
          <HeadingComponent model={visibleWidget} />
        ) : (
          <Typography variant="h6">{heading}</Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton color="inherit" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  )
})

const ModalWidget = observer(function ModalWidget({
  session,
  onClose,
}: {
  session: SessionWithWidgets
  onClose: () => void
}) {
  const { classes } = useStyles()
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  if (!visibleWidget) {
    return null
  }
  const widgetType = pluginManager.getWidgetType(visibleWidget.type)
  if (!widgetType) {
    throw new Error(`unknown widget type ${visibleWidget.type}`)
  }
  const { ReactComponent } = widgetType
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      header={<DrawerAppBar onClose={onClose} session={session} />}
    >
      {ReactComponent ? (
        <Suspense fallback={<LoadingEllipses />}>
          <Paper className={classes.paper}>
            <PluggableComponent
              pluginManager={pluginManager}
              name="Core-replaceWidget"
              component={ReactComponent}
              props={{
                model: visibleWidget,
                session,
                modal: true,
                overrideDimensions: {
                  height: (window.innerHeight * 5) / 8,
                  width: 800,
                },
              }}
            />
          </Paper>
        </Suspense>
      ) : null}
    </Dialog>
  )
})

export default ModalWidget
