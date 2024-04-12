import React, { useEffect, useRef } from 'react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'

// locals
import ViewMenu from './ViewMenu'
import ViewContainerTitle from './ViewContainerTitle'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  viewHeader: {
    display: 'flex',
    height: 28,
    position: 'sticky',
    top: 0,
    zIndex: 7,
    background: theme.palette.secondary.main,
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
  className,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  className?: string
}) {
  const { classes, cx } = useStyles()
  const scrollRef = useRef<HTMLDivElement>(null)
  const session = getSession(view)

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])
  return (
    <div ref={scrollRef} className={cx(classes.viewHeader, className)}>
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
