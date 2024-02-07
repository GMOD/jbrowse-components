import React from 'react'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

// locals
import OpenInNew from '@mui/icons-material/OpenInNew'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
}))

const ViewHeaderButtons = observer(function ({
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
      <IconButton
        data-testid="open_in_new"
        onClick={() => view.setFloating(true)}
      >
        <OpenInNew className={classes.icon} fontSize="small" />
      </IconButton>
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

export default ViewHeaderButtons
