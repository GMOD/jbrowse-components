import React, { useState, lazy } from 'react'
import { observer } from 'mobx-react'
import { Button, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { AbstractSessionModel } from '@jbrowse/core/util'

// icons
import ShareIcon from '@mui/icons-material/Share'

const useStyles = makeStyles()(theme => ({
  shareDiv: {
    textAlign: 'center',
    paddingLeft: '2px',
  },
  shareButton: {
    backgroundColor: alpha(
      theme.palette.primary.contrastText,
      theme.palette.action.hoverOpacity,
    ),
    '&:hover': {
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

const ShareDialog = lazy(() => import('./ShareDialog'))

export default observer(function (props: {
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [open, setOpen] = useState(false)
  const { session } = props
  const { classes } = useStyles()

  return (
    <div className={classes.shareDiv}>
      <Button
        onClick={async () => setOpen(true)}
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
        classes={{ root: classes.shareButton }}
      >
        Share
      </Button>
      {open ? (
        <React.Suspense fallback={<React.Fragment />}>
          <ShareDialog handleClose={() => setOpen(false)} session={session} />
        </React.Suspense>
      ) : null}
    </div>
  )
})
