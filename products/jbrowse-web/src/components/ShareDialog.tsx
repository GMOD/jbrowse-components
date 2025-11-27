import { lazy, useEffect, useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  localStorageGetItem,
} from '@jbrowse/core/util'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  IconButton,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { shareSessionToDynamo } from '../sessionSharing'
import { setQueryParams } from '../useQueryParam'
import { toUrlSafeB64 } from '../util'
import ShareDialogLinkField from './ShareDialogLinkField'

const SettingsDialog = lazy(() => import('./ShareSettingsDialog'))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

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

  const url = session.shareURL
  const currentSetting =
    localStorageGetItem(SHARE_URL_LOCALSTORAGE_KEY) || 'short'
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
        console.error(e)
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
              <ShareDialogLinkField url={shortUrl} />
            )
          ) : (
            <ShareDialogLinkField url={longUrl} />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<BookmarkAddIcon />}
            disabled={disabled}
            onClick={event => {
              event.preventDefault()
              setQueryParams({
                password: passwordParam,
                session: sessionParam,
              })
              alert('Now press Ctrl+D (PC) or Cmd+D (Mac)')
            }}
          >
            Create browser Bookmark
          </Button>

          <Button
            startIcon={<ContentCopyIcon />}
            disabled={disabled}
            onClick={async () => {
              const { default: copy } = await import('copy-to-clipboard')
              copy(shortUrl || longUrl)
              session.notify('Copied to clipboard', 'success')
            }}
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
        currentSetting={currentSetting}
        onClose={() => {
          setSettingsDialogOpen(false)
        }}
      />
    </>
  )
})

export default ShareDialog
