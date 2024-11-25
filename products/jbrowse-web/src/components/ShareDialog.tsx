import React, { useState, useEffect, lazy } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

// icons
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import SettingsIcon from '@mui/icons-material/Settings'
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
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { StringParam, useQueryParam } from 'use-query-params'

// locals
import { shareSessionToDynamo } from '../sessionSharing'
import { toUrlSafeB64 } from '../util'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const SettingsDialog = lazy(() => import('./ShareSettingsDialog'))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

function LinkField({ url }: { url: string }) {
  return (
    <TextField
      label="URL"
      value={url}
      variant="filled"
      fullWidth
      onClick={event => {
        const target = event.target as HTMLTextAreaElement
        target.select()
      }}
      slotProps={{
        input: { readOnly: true },
      }}
    />
  )
}

const ShareDialog = observer(function ({
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      // checking !error allows retry when error state is cleared
      if (error) {
        return
      }
      try {
        if (currentSetting === 'short') {
          setLoading(true)
          const locationUrl = new URL(window.location.href)
          const result = await shareSessionToDynamo(snap, url, locationUrl.href)
          const params = new URLSearchParams(locationUrl.search)
          params.set('session', `share-${result.json.sessionId}`)
          params.set('password', result.password)
          locationUrl.search = params.toString()
          setShortUrl(locationUrl.href)

          setSessionParam(`share-${result.json.sessionId}`)
          setPasswordParam(result.password)
        } else {
          const sess = await toUrlSafeB64(JSON.stringify(getSnapshot(session)))
          const longUrl = new URL(window.location.href)
          const longParams = new URLSearchParams(longUrl.search)
          longParams.set('session', `encoded-${sess}`)
          setSessionParam(`encoded-${sess}`)
          longUrl.search = longParams.toString()
          setLongUrl(longUrl.toString())
        }
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [currentSetting, error, session, url, snap])

  const disabled = (currentSetting === 'short' && loading) || !!error
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
            <IconButton
              onClick={() => {
                setSettingsDialogOpen(true)
              }}
            >
              <SettingsIcon />
            </IconButton>
          </DialogContentText>

          {currentSetting === 'short' ? (
            error ? (
              <ErrorMessage
                error={error}
                onReset={() => {
                  setError(undefined)
                }}
              />
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
            disabled={disabled}
            onClick={event => {
              event.preventDefault()
              setPassword(passwordParam, 'replaceIn')
              setSession(sessionParam, 'replaceIn')
              alert('Now press Ctrl+D (PC) or Cmd+D (Mac)')
            }}
          >
            Create browser Bookmark
          </Button>

          <Button
            onClick={() => {
              copy(shortUrl || longUrl)
              session.notify('Copied to clipboard', 'success')
            }}
            startIcon={<ContentCopyIcon />}
            disabled={disabled}
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
        onClose={() => {
          setSettingsDialogOpen(false)
        }}
        currentSetting={currentSetting}
      />
    </>
  )
})

export default ShareDialog
