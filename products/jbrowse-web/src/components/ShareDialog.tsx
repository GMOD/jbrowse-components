import { useState } from 'react'

import { ErrorBanner, InfoDialog } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import SessionJsonPanel from '@jbrowse/core/ui/SessionJsonPanel'
import ShareLinkField from '@jbrowse/core/ui/ShareLinkField'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { copyTextWithSession } from '@jbrowse/core/util/copyText'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { getShareableSessionSnapshot } from '@jbrowse/product-core'
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogContentText,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ShareInfoDialog from './ShareInfoDialog.tsx'
import { buildShareUrl } from './buildShareUrl.ts'
import { findLocalFileNames } from './localFileTracks.ts'

import type { SessionShareMode, SessionWithShareURL } from '@jbrowse/core/util'

// remembers the chosen share mode, not a URL
export const SHARE_MODE_LOCALSTORAGE_KEY = 'jbrowse-shareMode'

const SHARE_MODES = [
  { value: 'short', label: 'Short URL' },
  { value: 'long', label: 'Long URL' },
] as const

function storedMode(): SessionShareMode {
  const stored = localStorageGetItem(SHARE_MODE_LOCALSTORAGE_KEY)
  return SHARE_MODES.find(m => m.value === stored)?.value ?? 'short'
}

const ShareDialog = observer(function ShareDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: SessionWithShareURL
}) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [mode, setMode] = useState(storedMode)
  // Snapshotted once on open, so the session changing under the dialog does
  // not re-upload it. Stamps what the live session resolves at read time, so
  // the recipient sees what the sender saw.
  const [snap] = useState(() => getShareableSessionSnapshot(session))
  const localFileNames = findLocalFileNames(snap)
  // The bookmark button below has to put the share URL in the address bar — a
  // browser can only bookmark what is there. Nothing put the page's own URL
  // back afterwards, and the address bar is what a reload restores from
  // (JBrowse.tsx keeps `session=local-<id>` there for exactly that): a tab left
  // pointing at the share link reloads the snapshot the link was built from and
  // silently drops everything done since. So capture the page URL on open and
  // put it back on close — a bookmark keeps whatever the URL was at the moment
  // it was pressed, so restoring afterwards costs it nothing.
  const [pageUrl] = useState(() => window.location.href)
  function close() {
    window.history.replaceState(null, '', pageUrl)
    handleClose()
  }

  // One link per mode for the dialog's lifetime: coming back to short would
  // otherwise upload the same snapshot again, and StrictMode's doubled effect
  // uploaded it twice on open. A failure is dropped so a retry builds anew.
  const [links] = useState(() => new Map<SessionShareMode, Promise<string>>())
  const { data, error, isLoading, mutate } = useFetch(
    ['shareUrl', mode],
    () => {
      let link = links.get(mode)
      if (!link) {
        link = buildShareUrl(mode, snap, session.shareURL, pageUrl)
        link.catch(() => {
          links.delete(mode)
        })
        links.set(mode, link)
      }
      return link
    },
  )

  const url = data ?? ''
  const disabled = isLoading || !!error
  return (
    <>
      <InfoDialog
        maxWidth="xl"
        open
        onClose={close}
        title="JBrowse Shareable Link"
        actions={
          <>
            <Button
              startIcon={<BookmarkAddIcon />}
              disabled={disabled}
              onClick={() => {
                window.history.replaceState(null, '', url)
                alert('Now press Ctrl+D (PC) or Cmd+D (Mac)')
              }}
            >
              Create browser Bookmark
            </Button>
            <Button
              startIcon={<ContentCopyIcon />}
              disabled={disabled}
              onClick={() => {
                void copyTextWithSession(session, url, 'URL')
              }}
            >
              Copy to Clipboard
            </Button>
          </>
        }
      >
        {localFileNames.length > 0 ? (
          <Alert severity="warning">
            These use files from your computer, which a share link cannot carry,
            so the recipient will see them empty: {localFileNames.join(', ')}
          </Alert>
        ) : null}
        <DialogContentText>
          Copy the URL below to share your current JBrowse session.
          <CascadingMenuButton
            tooltip="Session sharing settings"
            menuItems={[
              ...SHARE_MODES.map(({ value, label }) => ({
                label,
                type: 'radio' as const,
                checked: mode === value,
                onClick: () => {
                  localStorageSetItem(SHARE_MODE_LOCALSTORAGE_KEY, value)
                  setMode(value)
                },
              })),
              {
                label: 'About session URLs',
                onClick: () => {
                  setInfoDialogOpen(true)
                },
              },
            ]}
          >
            <SettingsIcon />
          </CascadingMenuButton>
        </DialogContentText>

        {error ? (
          <ErrorBanner
            error={error}
            onReset={() => {
              mutate()
            }}
          />
        ) : isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography>Generating {mode} URL...</Typography>
          </Box>
        ) : (
          <ShareLinkField value={url} />
        )}
        <SessionJsonPanel session={snap} />
      </InfoDialog>

      <ShareInfoDialog
        open={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false)
        }}
      />
    </>
  )
})

export default ShareDialog
