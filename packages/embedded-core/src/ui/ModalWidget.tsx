import React, { Suspense } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { AppBar, Paper, Toolbar, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import type { SessionWithWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
  },
})

const ModalWidget = observer(function ({
  session,
}: {
  session: SessionWithWidgets
}) {
  const { classes } = useStyles()
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  if (!visibleWidget) {
    return null
  }
  const { ReactComponent, HeadingComponent, heading } =
    pluginManager.getWidgetType(visibleWidget.type)

  const Component = pluginManager.evaluateExtensionPoint(
    'Core-replaceWidget',
    ReactComponent,
    {
      session,
      model: visibleWidget,
    },
  ) as React.FC<any>
  return (
    <Dialog
      open
      onClose={() => {
        session.hideAllWidgets()
      }}
      maxWidth="xl"
      header={
        <AppBar position="static">
          <Toolbar>
            {HeadingComponent ? (
              <HeadingComponent model={visibleWidget} />
            ) : (
              <Typography variant="h6">{heading}</Typography>
            )}
          </Toolbar>
        </AppBar>
      }
    >
      <Suspense fallback={<div>Loading...</div>}>
        <Paper className={classes.paper}>
          <Component
            model={visibleWidget}
            session={session}
            overrideDimensions={{
              height: (window.innerHeight * 5) / 8,
              width: 800,
            }}
          />
        </Paper>
      </Suspense>
    </Dialog>
  )
})

export default ModalWidget
