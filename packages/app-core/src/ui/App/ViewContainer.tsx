import React, { useEffect, useRef } from 'react'
import { IconButton, Paper, useTheme } from '@mui/material'
import { darken } from '@mui/material/styles'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession, useWidthSetter } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

// icons
import CancelIcon from '@mui/icons-material/Cancel'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

// locals
import ViewMenu from './ViewMenu'
import ViewContainerTitle from './ViewContainerTitle'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  },
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  darkenedIcon: {
    color: darken(theme.palette.secondary.contrastText, 0.4),
  },
  grow: {
    flexGrow: 1,
  },
  focusedView: {
    position: 'relative',
  },
}))

export default observer(function ({
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
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view) as SessionWithFocusedViewAndDrawerWidgets

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])

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

  const iconClass =
    session.focusedViewId === view.id ? classes.icon : classes.darkenedIcon
  return (
    <Paper
      ref={ref}
      elevation={session.focusedViewId === view.id ? 24 : 0}
      className={
        session.focusedViewId === view.id
          ? `${classes.viewContainer} ${classes.focusedView}`
          : classes.viewContainer
      }
    >
      <div ref={scrollRef} style={{ display: 'flex' }}>
        <ViewMenu model={view} IconProps={{ className: iconClass }} />
        <div className={classes.grow} />

        <ViewContainerTitle view={view} />
        <div className={classes.grow} />
        <IconButton data-testid="minimize_view" onClick={onMinimize}>
          {view.minimized ? (
            <AddIcon className={iconClass} fontSize="small" />
          ) : (
            <MinimizeIcon className={iconClass} fontSize="small" />
          )}
        </IconButton>
        <IconButton data-testid="close_view" onClick={onClose}>
          {session.focusedViewId === view.id ? (
            <CancelIcon className={iconClass} fontSize="small" />
          ) : (
            <CloseIcon className={iconClass} fontSize="small" />
          )}
        </IconButton>
      </div>
      <Paper>{children}</Paper>
    </Paper>
  )
})
