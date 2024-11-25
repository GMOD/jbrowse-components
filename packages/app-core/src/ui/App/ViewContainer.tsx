import React, { useEffect } from 'react'
import { getSession, useWidthSetter } from '@jbrowse/core/util'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import ViewHeader from './ViewHeader'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

// locals

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
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
        session.setFocusedViewId(view.id)
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref, session, view])

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
