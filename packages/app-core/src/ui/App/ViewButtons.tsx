import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
}))

// Acts on the view directly rather than taking onClose/onMinimize callbacks.
// Those were written inline by ViewContainer, three components up, so they were
// fresh on every one of its renders and mobx-react's memo could never hold for
// this subtree. A resize of the view body re-rendered these MUI buttons along
// with the header and the menu. There was nothing for the caller to decide
// anyway: both handlers are the same two lines wherever they are written.
const ViewButtons = observer(function ViewButtons({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(view)
  return (
    <>
      <IconButton
        aria-label={view.minimized ? 'Restore view' : 'Minimize view'}
        data-testid="minimize_view"
        onClick={() => {
          view.setMinimized(!view.minimized)
        }}
      >
        {view.minimized ? (
          <AddIcon className={classes.icon} fontSize="small" />
        ) : (
          <MinimizeIcon className={classes.icon} fontSize="small" />
        )}
      </IconButton>
      <IconButton
        aria-label="Close view"
        data-testid="close_view"
        onClick={() => {
          session.removeView(view)
        }}
      >
        <CloseIcon className={classes.icon} fontSize="small" />
      </IconButton>
    </>
  )
})

export default ViewButtons
