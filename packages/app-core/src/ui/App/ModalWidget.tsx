import React, { Suspense } from 'react'
import { Dialog } from '@jbrowse/core/ui'

// icons
import CloseIcon from '@mui/icons-material/Close'
import { AppBar, IconButton, Paper, Toolbar, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import type { SessionWithWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    overflow: 'auto',
    minWidth: 800,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

const DrawerAppBar = observer(function DrawerAppBar({
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
  const { HeadingComponent, heading } = pluginManager.getWidgetType(
    visibleWidget.type,
  )

  return (
    <AppBar position="static">
      <Toolbar>
        {HeadingComponent ? (
          <HeadingComponent model={visibleWidget} />
        ) : (
          <Typography variant="h6">{heading}</Typography>
        )}
      </Toolbar>
      <IconButton className={classes.closeButton} onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </AppBar>
  )
})

const ModalWidget = observer(function ({
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
  const { ReactComponent } = pluginManager.getWidgetType(visibleWidget.type)
  const Component = pluginManager.evaluateExtensionPoint(
    'Core-replaceWidget',
    ReactComponent,
    {
      session,
      model: visibleWidget,
    },
  ) as React.FC<any> | undefined
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xl"
      header={<DrawerAppBar onClose={onClose} session={session} />}
    >
      {Component ? (
        <Suspense fallback={<div>Loading...</div>}>
          <Paper className={classes.paper}>
            <Component
              model={visibleWidget}
              session={session}
              modal={true}
              overrideDimensions={{
                height: (window.innerHeight * 5) / 8,
                width: 800,
              }}
            />
          </Paper>
        </Suspense>
      ) : null}
    </Dialog>
  )
})

export default ModalWidget
