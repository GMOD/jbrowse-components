import { useEffect } from 'react'

import { useWidthSetter } from '@jbrowse/core/util'
import { Paper, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import ViewHeader from './ViewHeader'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'
import ViewWrapper from './ViewWrapper'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
    overflow: 'clip',
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    // note that contain:paint also seems to work
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
}: {
  view: AbstractViewModel
  onClose: () => void
  onMinimize: () => void
  session: SessionWithFocusedViewAndDrawerWidgets
  children: React.ReactNode
}) {
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { classes, cx } = useStyles()
  console.log({ session })

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
  )

  return (
    <Paper ref={ref} elevation={12} className={viewContainerClassName}>
      {view.isFloating ? (
        <>
          <div style={{ cursor: 'all-scroll' }}>
            <ViewHeader view={view} onClose={onClose} onMinimize={onMinimize} />
          </div>
          <Paper>{children}</Paper>
        </>
      ) : (
        <>
          <ViewHeader
            view={view}
            onClose={() => {
              session.removeView(view)
            }}
            onMinimize={() => {
              view.setMinimized(!view.minimized)
            }}
            className={backgroundColorClassName}
          />
          <Paper elevation={0}>
            <ViewWrapper view={view} session={session} />
          </Paper>
        </>
      )}
    </Paper>
  )
})

export default ViewContainer
