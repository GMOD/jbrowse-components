import { Suspense, lazy, useState } from 'react'

import { Dialog, ErrorBanner } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  localStorageGetItem,
  useFetch,
} from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
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

import ShareDialogLinkField from './ShareDialogLinkField.tsx'
import { buildLongShareUrl, buildShortShareUrl } from './buildShareUrl.ts'
import { setQueryParams } from '../useQueryParam.ts'

const SettingsDialog = lazy(() => import('./ShareSettingsDialog.tsx'))

const SHARE_URL_LOCALSTORAGE_KEY = 'jbrowse-shareURL'

const ShareDialog = observer(function ShareDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  const shareURL = session.shareURL
  const currentSetting =
    localStorageGetItem(SHARE_URL_LOCALSTORAGE_KEY) || 'short'
  // Capture snapshot once when dialog opens — we don't want to re-upload every
  // time the session mutates while the dialog is open
  const [snap] = useState(() => getSnapshot(session))

  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(
    ['shareUrl', currentSetting],
    () =>
      currentSetting === 'short'
        ? buildShortShareUrl(snap, shareURL)
        : buildLongShareUrl(snap),
  )

  const url = data?.url ?? ''
  const disabled = loading || !!error
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

          {error ? (
            <ErrorBanner
              error={error}
              onReset={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                mutate()
              }}
            />
          ) : loading ? (
            <Typography>Generating short URL...</Typography>
          ) : (
            <ShareDialogLinkField url={url} />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<BookmarkAddIcon />}
            disabled={disabled}
            onClick={event => {
              event.preventDefault()
              setQueryParams({
                password: data?.passwordParam ?? '',
                session: data?.sessionParam ?? '',
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
              await copy(url)
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

      <Suspense fallback={null}>
        <SettingsDialog
          open={settingsDialogOpen}
          currentSetting={currentSetting}
          onClose={() => {
            setSettingsDialogOpen(false)
          }}
        />
      </Suspense>
    </>
  )
})

export default ShareDialog
