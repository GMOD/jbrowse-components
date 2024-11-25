import React, { useState, lazy } from 'react'
import ShareIcon from '@mui/icons-material/Share'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// icons

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

const ShareButton = observer(function (props: {
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [open, setOpen] = useState(false)
  const { session } = props
  const { classes } = useStyles()

  return (
    <div className={classes.shareDiv}>
      <Button
        onClick={async () => {
          setOpen(true)
        }}
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
        classes={{ root: classes.shareButton }}
      >
        Share
      </Button>
      {open ? (
        <React.Suspense fallback={null}>
          <ShareDialog
            handleClose={() => {
              setOpen(false)
            }}
            session={session}
          />
        </React.Suspense>
      ) : null}
    </div>
  )
})

export default ShareButton
