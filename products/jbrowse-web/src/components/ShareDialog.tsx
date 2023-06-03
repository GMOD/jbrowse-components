import React, { useState, useEffect, lazy } from 'react'
import { getSnapshot } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import copy from 'copy-to-clipboard'
import { StringParam, useQueryParam } from 'use-query-params'
import { AbstractSessionModel } from '@jbrowse/core/util'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'

// locals
import { toUrlSafeB64 } from '../util'
import { shareSessionToDynamo } from '../sessionSharing'

const SettingsDialog = lazy(() => import('./ShareSettingsDialog'))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

function LinkField({ url }: { url: string }) {
  return (
    <TextField
      label="URL"
      value={url}
      InputProps={{ readOnly: true }}
      variant="filled"
      fullWidth
      onClick={event => {
        const target = event.target as HTMLTextAreaElement
        target.select()
      }}
    />
  )
}

export default observer(function ({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [sessionParam, setSessionParam] = useState('')
  const [passwordParam, setPasswordParam] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [longUrl, setLongUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>()
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [, setPassword] = useQueryParam('password', StringParam)
  const [, setSession] = useQueryParam('session', StringParam)

  const url = session.shareURL
  const currentSetting =
    localStorage.getItem(SHARE_URL_LOCALSTORAGE_KEY) || 'short'
  const snap = getSnapshot(session)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (currentSetting === 'short') {
          setLoading(true)
          const locationUrl = new URL(window.location.href)
          const result = await shareSessionToDynamo(snap, url, locationUrl.href)
          if (!cancelled) {
            const params = new URLSearchParams(locationUrl.search)
            params.set('session', `share-${result.json.sessionId}`)
            params.set('password', result.password)
            locationUrl.search = params.toString()
            setShortUrl(locationUrl.href)

            setSessionParam(`share-${result.json.sessionId}`)
            setPasswordParam(result.password)
          }
        } else {
          const sess = await toUrlSafeB64(JSON.stringify(getSnapshot(session)))
          const longUrl = new URL(window.location.href)
          const longParams = new URLSearchParams(longUrl.search)
          longParams.set('session', `encoded-${sess}`)
          setSessionParam(`encoded-${sess}`)
          longUrl.search = longParams.toString()
          if (!cancelled) {
            setLongUrl(longUrl.toString())
          }
        }
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentSetting, session, url, snap])

  return (
    <>
      <Dialog
        maxWidth="xl"
        open
        onClose={handleClose}
        title="JBrowse Shareable Link"
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
              <ErrorMessage error={error} />
            ) : loading ? (
              <Typography>Generating short URL...</Typography>
            ) : (
              <LinkField url={shortUrl} />
            )
          ) : (
            <LinkField url={longUrl} />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<BookmarkAddIcon />}
            disabled={currentSetting === 'short' && loading}
            onClick={event => {
              event.preventDefault()
              setPassword(passwordParam)
              setSession(sessionParam)
              alert('Now press Ctrl+D (PC) or Cmd+D (Mac)')
            }}
          >
            Bookmark
          </Button>

          <Button
            onClick={() => {
              copy(shortUrl || longUrl)
              session.notify('Copied to clipboard', 'success')
            }}
            startIcon={<ContentCopyIcon />}
            disabled={currentSetting === 'short' && loading}
          >
            Copy to Clipboard
          </Button>

          <Button onClick={handleClose} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <SettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        currentSetting={currentSetting}
      />
    </>
  )
})
