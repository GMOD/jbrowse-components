import React, { useState, useEffect } from 'react'
import Button from '@material-ui/core/Button'
import ShareIcon from '@material-ui/icons/Share'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@material-ui/core'

import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import SettingsIcon from '@material-ui/icons/Settings'
import CloseIcon from '@material-ui/icons/Close'
import copy from 'copy-to-clipboard'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { getSnapshot } from 'mobx-state-tree'
import { toUrlSafeB64 } from '@jbrowse/core/util'
import { shareSessionToDynamo } from './sessionSharing'
import { SessionModel } from './sessionModelFactory'

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
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

function SettingsDialog(props: {
  open: boolean
  onClose: Function
  currentSetting: string
}) {
  const classes = useStyles()
  const { onClose, open, currentSetting } = props
  const [setting, setSetting] = useState(currentSetting)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)

  const handleClose = () => {
    localStorage.setItem(SHARE_URL_LOCALSTORAGE_KEY, setting)
    onClose(setting)
  }

  return (
    <>
      <Dialog onClose={handleClose} open={open}>
        <DialogTitle>
          Configure session sharing
          {handleClose ? (
            <IconButton className={classes.closeButton} onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select between generating long or short URLs for the session sharing
            <IconButton onClick={() => setInfoDialogOpen(true)}>
              <HelpOutlineIcon />
            </IconButton>
          </DialogContentText>
          <FormControl component="fieldset">
            <RadioGroup
              value={setting}
              onChange={event => {
                const val = event.target.value
                setSetting(val)
              }}
            >
              <FormControlLabel
                value="short"
                control={<Radio />}
                label="Short URL"
              />
              <FormControlLabel
                value="long"
                control={<Radio />}
                label="Long URL"
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
      </Dialog>
      <InfoDialog
        open={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false)
        }}
      />
    </>
  )
}
function InfoDialog(props: { open: boolean; onClose: Function }) {
  const classes = useStyles()
  const { onClose, open } = props

  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog onClose={handleClose} open={open}>
      <DialogTitle id="simple-dialog-title">
        Info about session URLs
        {onClose ? (
          <IconButton className={classes.closeButton} onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Because everything about the JBrowse session is encoded in the URL
          (e.g. state of the tracks, views, features selected, etc.) the
          sessions can get very long. Therefore, we created a URL shortener,
          both as a convenience and because long URLs can break some programs.
          Note that both the long and short URLs encode the same data, but due
          to long URLs causing problems with some programs, we recommend sharing
          short URLs.
        </DialogContentText>
        <DialogContentText>
          We generate the short URLs in a secure manner which involves
          encrypting the session on the client side with a random password
          string and uploading them to a central database. Then the random
          password is added to the URL but is not uploaded to the central
          database, making these short URLs effectively &quot;end-to-end
          encrypted&quot;
        </DialogContentText>
        <DialogContentText>
          Only users with a share link can read the session.
        </DialogContentText>
      </DialogContent>
    </Dialog>
  )
}

const ShareDialog = observer(
  ({
    handleClose,
    session,
  }: {
    handleClose: () => void
    session: SessionModel
  }) => {
    const classes = useStyles()
    const [shortUrl, setShortUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error>()
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

    const url = session.shareURL
    const currentSetting =
      localStorage.getItem(SHARE_URL_LOCALSTORAGE_KEY) || 'short'
    const snap = getSnapshot(session)

    useEffect(() => {
      let cancelled = false
      ;(async () => {
        if (currentSetting === 'short') {
          try {
            setLoading(true)
            const locationUrl = new URL(window.location.href)
            const result = await shareSessionToDynamo(
              snap,
              url,
              locationUrl.href,
            )
            if (!cancelled) {
              setLoading(false)
              const params = new URLSearchParams(locationUrl.search)
              params.set('session', `share-${result.json.sessionId}`)
              params.set('password', result.password)
              locationUrl.search = params.toString()
              setShortUrl(locationUrl.href)
            }
          } catch (e) {
            setLoading(false)
            setError(e)
          }
        }
      })()

      return () => {
        cancelled = true
      }
    }, [currentSetting, url, snap])

    // generate long URL
    const sess = `${toUrlSafeB64(JSON.stringify(getSnapshot(session)))}`
    const longUrl = new URL(window.location.href)
    const longParams = new URLSearchParams(longUrl.search)
    longParams.set('session', `encoded-${sess}`)
    longUrl.search = longParams.toString()
    return (
      <>
        <Dialog
          maxWidth="xl"
          open
          onClose={handleClose}
          data-testid="share-dialog"
        >
          <DialogTitle>
            JBrowse Shareable Link
            {handleClose ? (
              <IconButton className={classes.closeButton} onClick={handleClose}>
                <CloseIcon />
              </IconButton>
            ) : null}
          </DialogTitle>
          <Divider />

          <>
            <DialogContent>
              <DialogContentText>
                Copy the URL below to share your current JBrowse session.
                <IconButton onClick={() => setSettingsDialogOpen(true)}>
                  <SettingsIcon />
                </IconButton>
              </DialogContentText>
            </DialogContent>

            <DialogContent>
              {currentSetting === 'short' ? (
                error ? (
                  <Typography color="error">{`${error}`}</Typography>
                ) : loading ? (
                  <Typography>Generating short URL...</Typography>
                ) : (
                  <TextField
                    label="URL"
                    value={shortUrl}
                    InputProps={{
                      readOnly: true,
                    }}
                    inputProps={{ 'data-testid': 'share-url-text' }}
                    variant="filled"
                    style={{ width: '100%' }}
                    onClick={event => {
                      const target = event.target as HTMLTextAreaElement
                      target.select()
                    }}
                    data-testid="share-url-field"
                  />
                )
              ) : (
                <TextField
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
              )}
            </DialogContent>
          </>
          <DialogActions>
            <Button
              onClick={() => {
                copy(shortUrl || longUrl.toString())
                session.notify('Copied to clipboard', 'success')
              }}
              color="primary"
              startIcon={<ContentCopyIcon />}
              disabled={currentSetting === 'short' && loading}
            >
              Copy URL to Clipboard
            </Button>

            <Button onClick={handleClose} color="primary" autoFocus>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <SettingsDialog
          open={settingsDialogOpen}
          onClose={() => {
            setSettingsDialogOpen(false)
          }}
          currentSetting={currentSetting}
        />
      </>
    )
  },
)

const ShareButton = observer((props: { session: SessionModel }) => {
  const [open, setOpen] = useState(false)

  const { session } = props
  const classes = useStyles()

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <div className={classes.shareDiv}>
      <Button
        data-testid="share_button"
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
        <ShareDialog handleClose={handleClose} session={session} />
      ) : null}
    </div>
  )
})

export default ShareButton
