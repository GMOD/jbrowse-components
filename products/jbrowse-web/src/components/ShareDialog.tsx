import { useState } from 'react'

import {
  ErrorBanner,
  InfoDialog,
  LabeledCheckbox,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
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
import { SHARE_MODE_LOCALSTORAGE_KEY, buildShareUrl } from './buildShareUrl.ts'
import { findLocalFileNames } from './localFileTracks.ts'

import type { SessionShareMode, SessionWithShareURL } from '@jbrowse/core/util'

const SHARE_MODES = [
  { value: 'short', label: 'Short URL' },
  { value: 'long', label: 'Long URL' },
  { value: 'json', label: 'Plaintext JSON' },
] as const

const ShareDialog = observer(function ShareDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: SessionWithShareURL
}) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [showReadableJson, setShowReadableJson] = useState(false)

  const shareURL = session.shareURL
  const [currentSetting, setCurrentSetting] = useState<SessionShareMode>(
    () =>
      (localStorageGetItem(SHARE_MODE_LOCALSTORAGE_KEY) ??
        'short') as SessionShareMode,
  )
  // Capture snapshot once when dialog opens — we don't want to re-upload every
  // time the session mutates while the dialog is open. Bake the live
  // promotable-default cascade into concrete track values so the recipient sees
  // what the sender saw without inheriting their personal (un-shared) defaults.
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

  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(['shareUrl', currentSetting], () =>
    buildShareUrl(currentSetting, snap, shareURL),
  )

  const url = data?.url ?? ''
  const plaintext = data?.plaintext
  const disabled = loading || !!error
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
              onClick={event => {
                event.preventDefault()
                // point the address bar at the assembled share URL (inline
                // sessions live in the hash, see buildShareUrl) so the bookmark
                // the user saves is the shareable one
                if (url) {
                  window.history.replaceState(null, '', url)
                }
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
                checked: currentSetting === value,
                onClick: () => {
                  // guarded write to match the guarded read above: a browser
                  // with storage disabled must not throw out of a menu click
                  localStorageSetItem(SHARE_MODE_LOCALSTORAGE_KEY, value)
                  setCurrentSetting(value)
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
        ) : loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography>Generating {currentSetting} URL...</Typography>
          </Box>
        ) : (
          <>
            <ShareLinkField value={url} />
            {plaintext ? (
              <LabeledCheckbox
                checked={showReadableJson}
                onChange={val => {
                  setShowReadableJson(val)
                }}
                label="Show readable JSON"
              />
            ) : null}
            {plaintext && showReadableJson ? (
              <MonospaceTextField
                label="Session JSON"
                value={plaintext}
                readOnly
                fullWidth
                maxRows={20}
              />
            ) : null}
          </>
        )}
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
