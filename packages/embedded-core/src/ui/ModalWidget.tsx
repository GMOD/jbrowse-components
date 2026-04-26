import { Suspense } from 'react'

import { Dialog, PluggableComponent } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { AppBar, Paper, Toolbar, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { SessionWithWidgets } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  paper: {
    overflow: 'auto',
  },
})

const ModalWidget = observer(function ModalWidget({
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
  const widgetType = pluginManager.getWidgetType(visibleWidget.type)
  if (!widgetType) {
    throw new Error(`unknown widget type ${visibleWidget.type}`)
  }
  const { ReactComponent, HeadingComponent, heading } = widgetType

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
          <PluggableComponent
            pluginManager={pluginManager}
            name="Core-replaceWidget"
            component={ReactComponent}
            props={{
              model: visibleWidget,
              session,
              overrideDimensions: {
                height: (window.innerHeight * 5) / 8,
                width: 800,
              },
            }}
          />
        </Paper>
      </Suspense>
    </Dialog>
  )
})

export default ModalWidget
