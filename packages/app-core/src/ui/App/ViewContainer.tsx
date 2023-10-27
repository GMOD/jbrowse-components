import React, { useEffect } from 'react'
import { Paper, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession, useWidthSetter } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

// locals
import ViewHeader from './ViewHeader'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    overflow: 'hidden',
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
  onClose,
  onMinimize,
  children,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  children: React.ReactNode
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes, cx } = useStyles()
  const session = getSession(view) as SessionWithFocusedViewAndDrawerWidgets

  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element) {
        if (ref?.current && ref.current.contains(e.target)) {
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

  useEffect(() => {
    // ensures there is always one view in focus, if there is a view open
    if (
      session.focusedViewId &&
      session.views.some(view => view.id === session.focusedViewId)
    ) {
      session.setFocusedViewId(session.focusedViewId)
    } else {
      session.setFocusedViewId(view.id)
    }
  }, [session.views.length, session, view.id])

  return (
    <Paper
      ref={ref}
      elevation={12}
      className={cx(
        classes.viewContainer,
        session.focusedViewId === view.id
          ? classes.focusedView
          : classes.unfocusedView,
      )}
    >
      <ViewHeader view={view} onClose={onClose} onMinimize={onMinimize} />
      <Paper>{children}</Paper>
    </Paper>
  )
})

export default ViewContainer
