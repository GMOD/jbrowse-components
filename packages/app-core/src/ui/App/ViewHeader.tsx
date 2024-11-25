import React, { useEffect, useRef } from 'react'
import { getSession } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import MinimizeIcon from '@mui/icons-material/Minimize'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import ViewContainerTitle from './ViewContainerTitle'
import ViewMenu from './ViewMenu'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  viewHeader: {
    display: 'flex',
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

const ViewButtons = observer(function ({
  view,
  onClose,
  onMinimize,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
}) {
  const { classes } = useStyles()
  return (
    <>
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
    </>
  )
})

const ViewHeader = observer(function ({
  view,
  onClose,
  onMinimize,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
}) {
  const { classes } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    if (typeof jest === 'undefined') {
      scrollRef.current?.scrollIntoView({ block: 'center' })
    }
  }, [])
  return (
    <div ref={scrollRef} className={classes.viewHeader}>
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <div className={classes.grow} />
      <div className={classes.viewTitle}>
        {session.focusedViewId === view.id ? (
          <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
        ) : null}
        <ViewContainerTitle view={view} />
      </div>
      <div className={classes.grow} />
      <ViewButtons onClose={onClose} onMinimize={onMinimize} view={view} />
    </div>
  )
})

export default ViewHeader
