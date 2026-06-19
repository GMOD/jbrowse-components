import { useState } from 'react'

import { Dialog, ErrorBanner, MonospaceTextField } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import ShareLinkField from '@jbrowse/core/ui/ShareLinkField'
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
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ShareInfoDialog from './ShareInfoDialog.tsx'
import {
  SHARE_URL_LOCALSTORAGE_KEY,
  buildJsonShareUrl,
  buildLongShareUrl,
  buildShortShareUrl,
} from './buildShareUrl.ts'
import { setQueryParams } from '../useQueryParam.ts'

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
  session: AbstractSessionModel & { shareURL: string }
}) {
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [showReadableJson, setShowReadableJson] = useState(false)

  const shareURL = session.shareURL
  const [currentSetting, setCurrentSetting] = useState(
    () => localStorageGetItem(SHARE_URL_LOCALSTORAGE_KEY) ?? 'short',
  )
  // Capture snapshot once when dialog opens — we don't want to re-upload every
  // time the session mutates while the dialog is open
  const [snap] = useState(() => getSnapshot(session))

  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(['shareUrl', currentSetting], () => {
    if (currentSetting === 'short') {
      return buildShortShareUrl(snap, shareURL)
    } else if (currentSetting === 'json') {
      return Promise.resolve(buildJsonShareUrl(snap))
    } else {
      return buildLongShareUrl(snap)
    }
  })

  const url = data?.url ?? ''
  const plaintext = data?.plaintext
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
            <CascadingMenuButton
              tooltip="Session sharing settings"
              menuItems={[
                ...SHARE_MODES.map(({ value, label }) => ({
                  label,
                  type: 'radio' as const,
                  checked: currentSetting === value,
                  onClick: () => {
                    localStorage.setItem(SHARE_URL_LOCALSTORAGE_KEY, value)
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
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                mutate()
              }}
            />
          ) : loading ? (
            <Typography>Generating {currentSetting} URL...</Typography>
          ) : (
            <>
              <ShareLinkField value={url} />
              {plaintext ? (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showReadableJson}
                      onChange={event => {
                        setShowReadableJson(event.target.checked)
                      }}
                    />
                  }
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
              const { default: copy } =
                await import('@jbrowse/core/util/copyToClipboard')
              if (copy(url)) {
                session.notify('Copied to clipboard', 'success')
              }
            }}
          >
            Copy to Clipboard
          </Button>

          <Button
            onClick={() => {
              handleClose()
            }}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
