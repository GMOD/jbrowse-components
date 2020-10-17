import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import ShareIcon from '@material-ui/icons/Share'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Divider from '@material-ui/core/Divider'
import IconButton from '@material-ui/core/IconButton'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import copy from 'copy-to-clipboard'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { getSnapshot } from 'mobx-state-tree'
import { toUrlSafeB64 } from '@jbrowse/core/util'
import { shareSessionToDynamo } from './sessionSharing'

const useStyles = makeStyles(theme => ({
  shareDiv: {
    textAlign: 'center',
    paddingLeft: '2px',
  },
  shareButton: {
    '&:hover': {
      backgroundColor: fade(
        theme.palette.primary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  loadingMessage: {
    padding: theme.spacing(5),
  },
}))

function InfoDialog(props: { open: boolean; onClose: Function }) {
  const { onClose, open } = props

  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog
      onClose={handleClose}
      aria-labelledby="simple-dialog-title"
      open={open}
    >
      <DialogTitle id="simple-dialog-title">
        Info about long and short URLs
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          <p>
            Because everything about the JBrowse session is encoded in the URL
            (e.g. state of the tracks, views, features selected, etc.) the
            sessions can get very long. Therefore, we created a URL shortener as
            a convenience. Both the long and short URLs encode the same thing
            but the short URLs are recommended.
          </p>
          <p>
            Note: the short URLs a generated in a secure manner which involves
            encrypting the session on the client side with a random nonce and
            uploading them to a central database. Then the random nonce is added
            to the URL but is not uploaded to the central database, making these
            short URLs effectively &quot;end-to-end encrypted&quot;
          </p>
          <p>Only users with this link can read this session.</p>
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Share = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()
  const url = session.shareURL

  const [open, setOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState('')
  const locationUrl = new URL(window.location.href)

  // generate long URL
  const sess = `${toUrlSafeB64(JSON.stringify(getSnapshot(session)))}`
  const longUrl = new URL(window.location.href)
  const longParams = new URLSearchParams(longUrl.search)
  longParams.set('session', `encoded-${sess}`)
  longUrl.search = longParams.toString()

  const handleClose = () => {
    setOpen(false)
    setLoading(false)
  }

  return (
    <div className={classes.shareDiv}>
      <Button
        data-testid="share_button"
        onClick={async () => {
          try {
            setOpen(true)
            setLoading(true)
            const result = await shareSessionToDynamo(
              session,
              url,
              locationUrl.href,
            )
            setLoading(false)
            const params = new URLSearchParams(locationUrl.search)
            params.set('session', `share-${result.json.sessionId}`)
            params.set('password', result.encryptedSession.iv)
            locationUrl.search = params.toString()
            setShareUrl(locationUrl.href)
          } catch (e) {
            session.notify(`Failed to generate a share link ${e}`, 'warning')
          }
        }}
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
        classes={{ root: classes.shareButton }}
      >
        Share
      </Button>
      <Dialog
        maxWidth="xl"
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          JBrowse Shareable Link
        </DialogTitle>
        <Divider />

        <>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <p>
                Copy either the short or long version of the URL below to share
                the session.
                <IconButton onClick={() => setInfoDialogOpen(true)}>
                  <HelpOutlineIcon />
                </IconButton>
              </p>
            </DialogContentText>
          </DialogContent>

          <DialogContent>
            <Typography>Short URL</Typography>
            {loading ? (
              <Typography>Generating short URL...</Typography>
            ) : (
              <TextField
                id="filled-read-only-input"
                label="URL"
                value={shareUrl}
                InputProps={{
                  readOnly: true,
                }}
                variant="filled"
                style={{ width: '100%' }}
                onClick={event => {
                  const target = event.target as HTMLTextAreaElement
                  target.select()
                }}
              />
            )}
            <Typography>Long URL</Typography>
            <TextField
              id="filled-read-only-input"
              label="URL"
              value={longUrl.toString()}
              InputProps={{
                readOnly: true,
              }}
              variant="filled"
              style={{ width: '100%' }}
              onClick={event => {
                const target = event.target as HTMLTextAreaElement
                target.select()
              }}
            />
          </DialogContent>
        </>
        <DialogActions>
          {!loading ? (
            <Button
              onClick={() => {
                copy(shareUrl)
                session.notify('Copied to clipboard', 'success')
              }}
              color="primary"
              startIcon={<ContentCopyIcon />}
            >
              Copy short URL to Clipboard
            </Button>
          ) : null}
          <Button
            onClick={() => {
              copy(longUrl.toString())
              session.notify('Copied to clipboard', 'success')
            }}
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy long URL to Clipboard
          </Button>
          <Button onClick={handleClose} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <InfoDialog
        open={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false)
        }}
      />
    </div>
  )
})

export default Share
