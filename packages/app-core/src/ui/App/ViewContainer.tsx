import { useEffect } from 'react'

import { useWidthSetter } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import ViewHeader from './ViewHeader'

import type { AppSession } from './types'
import type { AbstractViewModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
    overflow: 'clip',
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    // note that contain:paint also seems to work
  },
  floatingViewContainer: {
    padding: 0,
    margin: 0,
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
  session,
  children,
  contentHeight,
}: {
  view: AbstractViewModel
  onClose: () => void
  onMinimize: () => void
  session: AppSession
  children: React.ReactNode
  contentHeight?: number
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes } = useStyles()

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

  const backgroundColorClassName =
    session.focusedViewId === view.id
      ? classes.focusedView
      : classes.unfocusedView
  const viewContainerClassName = cx(
    classes.viewContainer,
    backgroundColorClassName,
    view.isFloating && classes.floatingViewContainer,
  )

  return (
    <Paper ref={ref} elevation={12} className={viewContainerClassName}>
      <div style={view.isFloating ? { cursor: 'all-scroll' } : undefined}>
        <ViewHeader
          view={view}
          onClose={onClose}
          onMinimize={onMinimize}
          className={view.isFloating ? undefined : backgroundColorClassName}
        />
      </div>
      <Paper
        elevation={view.isFloating ? undefined : 0}
        style={
          contentHeight !== undefined
            ? { height: contentHeight, overflow: 'auto' }
            : undefined
        }
      >
        {children}
      </Paper>
    </Paper>
  )
})

export default ViewContainer
