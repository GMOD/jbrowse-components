import React, { useState, useEffect } from 'react'
import { getSnapshot } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import copy from 'copy-to-clipboard'

import { alpha } from '@mui/material/styles'
import { makeStyles } from 'tss-react/mui'
import { AbstractSessionModel } from '@jbrowse/core/util'

// icons
import ShareIcon from '@mui/icons-material/Share'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import SettingsIcon from '@mui/icons-material/Settings'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

// locals
import { toUrlSafeB64 } from './util'
import { shareSessionToDynamo } from './sessionSharing'

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
  loadingMessage: {
    padding: theme.spacing(5),
  },
}))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

function SettingsDialog(props: {
  open: boolean
  onClose: Function
  currentSetting: string
}) {
  const { onClose, open, currentSetting } = props
  const [setting, setSetting] = useState(currentSetting)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)

  const handleClose = () => {
    localStorage.setItem(SHARE_URL_LOCALSTORAGE_KEY, setting)
    onClose(setting)
  }

  return (
    <>
      <Dialog
        onClose={handleClose}
        open={open}
        title="Configure session sharing"
      >
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
  const { onClose, open } = props

  return (
    <Dialog
      onClose={() => onClose()}
      open={open}
      title="Info about session URLs"
    >
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

const ShareDialog = observer(function ({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [shortUrl, setShortUrl] = useState('')
  const [longUrl, setLongUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>()
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const url = session.shareURL
  const currentSetting =
    localStorage.getItem(SHARE_URL_LOCALSTORAGE_KEY) || 'short'
  const snap = getSnapshot(session)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      if (currentSetting === 'short') {
        try {
          setLoading(true)
          const locationUrl = new URL(window.location.href)
          const result = await shareSessionToDynamo(snap, url, locationUrl.href)
          if (!cancelled) {
            const params = new URLSearchParams(locationUrl.search)
            params.set('session', `share-${result.json.sessionId}`)
            params.set('password', result.password)
            locationUrl.search = params.toString()
            setShortUrl(locationUrl.href)
          }
        } catch (e) {
          setError(e)
        } finally {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentSetting, url, snap])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const sess = await toUrlSafeB64(JSON.stringify(getSnapshot(session)))
        const longUrl = new URL(window.location.href)
        const longParams = new URLSearchParams(longUrl.search)
        longParams.set('session', `encoded-${sess}`)
        longUrl.search = longParams.toString()
        if (!cancelled) {
          setLongUrl(longUrl.toString())
        }
      } catch (e) {
        setError(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  return (
    <>
      <Dialog
        maxWidth="xl"
        open
        onClose={handleClose}
        title="JBrowse Shareable Link"
        data-testid="share-dialog"
      >
        <DialogContent>
          <DialogContentText>
            Copy the URL below to share your current JBrowse session.
            <IconButton onClick={() => setSettingsDialogOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </DialogContentText>

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
                variant="filled"
                style={{ width: '100%' }}
                onClick={event => {
                  const target = event.target as HTMLTextAreaElement
                  target.select()
                }}
              />
            )
          ) : (
            <TextField
              label="URL"
              value={longUrl}
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
})

const ShareButton = observer(function (props: {
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
        <ShareDialog handleClose={() => setOpen(false)} session={session} />
      ) : null}
    </div>
  )
})

export default ShareButton
