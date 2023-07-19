import React, { Suspense } from 'react'
import { AppBar, Paper, Toolbar, Typography } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { SessionWithWidgets } from '@jbrowse/core/util'

interface AdditionalComponentsObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Components: React.FC<any>
  configuration: 'top' | 'bottom'
}

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
  },
})

export default observer(function ({
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
  const AdditionalComponents = visibleWidget
    ? (pluginManager.evaluateExtensionPoint(
        'Core-addToWidget',
        pluginManager.getWidgetType(visibleWidget.type).ReactComponent,
        {
          session,
          model: visibleWidget,
        },
      ) as AdditionalComponentsObject)
    : null
  return (
    <Dialog
      open
      onClose={() => session.hideAllWidgets()}
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
      {Component ? (
        <Suspense fallback={<div>Loading...</div>}>
          <Paper className={classes.paper}>
            {AdditionalComponents?.Components &&
            AdditionalComponents.configuration === 'top' ? (
              <AdditionalComponents.Components
                model={visibleWidget}
                session={session}
              />
            ) : null}
            <Component
              model={visibleWidget}
              session={session}
              overrideDimensions={{
                height: (window.innerHeight * 5) / 8,
                width: 800,
              }}
            />
            {AdditionalComponents?.Components &&
            AdditionalComponents?.configuration === 'bottom' ? (
              <AdditionalComponents.Components
                model={visibleWidget}
                session={session}
              />
            ) : null}
          </Paper>
        </Suspense>
      ) : null}
    </Dialog>
  )
})
