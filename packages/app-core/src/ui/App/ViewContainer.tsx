import React, { useEffect, useRef, useState } from 'react'
import { IconButton, Paper, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { useWidthSetter } from '@jbrowse/core/util'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
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
  grow: {
    flexGrow: 1,
  },
  focusedView: {
    overflow: 'hidden',
    background: `repeating-linear-gradient(45deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.main} 5px, ${theme.palette.secondary.light} 5px, ${theme.palette.secondary.light} 10px)`,
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
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

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])

  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element) {
        if (ref?.current && ref.current.contains(e.target)) {
          // @ts-ignore
          getRoot(view).setFocusedViewId(view.id)
        }
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref])

  return (
    <Paper
      ref={ref}
      elevation={12}
      className={
        // @ts-ignore
        getRoot(view).focusedViewId === view.id
          ? classes.focusedView
          : classes.viewContainer
      }
    >
      <div ref={scrollRef} style={{ display: 'flex' }}>
        <ViewMenu model={view} IconProps={{ className: classes.icon }} />
        <div className={classes.grow} />

        <ViewContainerTitle view={view} />
        <div className={classes.grow} />
        <IconButton data-testid="minimize_view" onClick={onMinimize}>
          {view.minimized ? (
            <AddIcon className={classes.icon} fontSize="small" />
          ) : (
            <MinimizeIcon className={classes.icon} fontSize="small" />
          )}
        </IconButton>
        <IconButton data-testid="close_view" onClick={onClose}>
          <CloseIcon className={classes.icon} fontSize="small" />
        </IconButton>
      </div>
      <Paper>{children}</Paper>
    </Paper>
  )
})
