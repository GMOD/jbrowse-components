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
    border: `${theme.spacing(1)} solid`,
    borderColor: theme.palette.secondary.main,
  },
  focusedView: {
    background: theme.palette.secondary.main,
  },
  unfocusedView: {
    background: theme.palette.secondary.dark,
  },
}))

function useFocusEffect(
  ref: React.RefObject<HTMLDivElement | null>,
  session: AppSession,
  viewId: string,
) {
  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
        session.setFocusedViewId(viewId)
      }
    }
    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref, session, viewId])
}

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
  const { isFloating } = view

  useFocusEffect(ref, session, view.id)

  const isFocused = session.focusedViewId === view.id
  const backgroundColorClassName = isFocused
    ? classes.focusedView
    : classes.unfocusedView
  const viewContainerClassName = cx(
    classes.viewContainer,
    backgroundColorClassName,
    isFloating && classes.floatingViewContainer,
  )

  const header = (
    <ViewHeader
      view={view}
      onClose={onClose}
      onMinimize={onMinimize}
      className={isFloating ? undefined : backgroundColorClassName}
    />
  )

  return (
    <Paper ref={ref} elevation={12} className={viewContainerClassName}>
      {isFloating ? (
        <div style={{ cursor: 'all-scroll' }}>{header}</div>
      ) : (
        header
      )}
      <Paper
        elevation={isFloating ? undefined : 0}
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
