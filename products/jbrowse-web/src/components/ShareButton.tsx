import { Suspense, lazy, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import ShareIcon from '@mui/icons-material/Share'
import { Button, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

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
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
        classes={{ root: classes.shareButton }}
        onClick={async () => {
          setOpen(true)
        }}
      >
        Share
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <ShareDialog
            session={session}
            handleClose={() => {
              setOpen(false)
            }}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default ShareButton
