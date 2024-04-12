import React, { useEffect } from 'react'
import { Paper, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
  useWidthSetter,
} from '@jbrowse/core/util'

// locals
import ViewHeader from './ViewHeader'
import ViewWrapper from './ViewWrapper'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  },
  focusedView: {
    background: theme.palette.secondary.main,
  },
  unfocusedView: {
    background: theme.palette.secondary.dark,
  },
}))

const ViewContainer = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes, cx } = useStyles()

  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element) {
        if (ref?.current?.contains(e.target)) {
          session.setFocusedViewId(view.id)
        }
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref, session, view])

  const backgroundColorClassName =
    session.focusedViewId === view.id
      ? classes.focusedView
      : classes.unfocusedView
  const viewContainerClassName = cx(
    classes.viewContainer,
    backgroundColorClassName,
  )

  return (
    <>
      <Paper ref={ref} elevation={12} className={viewContainerClassName}>
        <ViewHeader
          view={view}
          onClose={() => session.removeView(view)}
          onMinimize={() => view.setMinimized(!view.minimized)}
          className={backgroundColorClassName}
        />
        <Paper elevation={0}>
          <ViewWrapper view={view} session={session} />
        </Paper>
      </Paper>
    </>
  )
})

export default ViewContainer
