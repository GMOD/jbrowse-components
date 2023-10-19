import React, { useEffect, useRef } from 'react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

// locals
import ViewMenu from './ViewMenu'
import ViewContainerTitle from './ViewContainerTitle'

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
}))

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

  // scroll the view into view when first mounted. note: this effect will run
  // only once, because of the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])
  return (
    <div ref={scrollRef} className={classes.viewHeader}>
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
  )
})

export default ViewHeader
