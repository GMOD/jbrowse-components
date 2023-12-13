import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import copy from 'copy-to-clipboard'

import { getSession, isSessionWithShareURL } from '@jbrowse/core/util'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

// locals
import { shareSessionToDynamo } from '../../sessionSharing'
import { GridBookmarkModel } from '../../model'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
}))

const ShareBookmarksDialog = observer(function ({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(true)
  const session = getSession(model)
  const { selectedBookmarks } = model
  const shareAll = selectedBookmarks.length === 0
  const bookmarksToShare =
    selectedBookmarks.length === 0
      ? model.allBookmarksModel
      : model.sharedBookmarksModel

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (!isSessionWithShareURL(session)) {
          throw new Error('No shareURL configured')
        }
        setLoading(true)
        const snap = getSnapshot(bookmarksToShare)
        const locationUrl = new URL(window.location.href)
        const result = await shareSessionToDynamo(
          snap,
          session.shareURL,
          locationUrl.href,
        )
        if (!cancelled) {
          const params = new URLSearchParams(locationUrl.search)
          params.set('bookmarks', `share-${result.json.sessionId}`)
          params.set('password', result.password)
          locationUrl.search = params.toString()
          setUrl(locationUrl.href)
          setLoading(false)
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
  }, [bookmarksToShare, session])
  return (
    <Dialog open onClose={onClose} title="Share bookmarks">
      <DialogContent
        style={{ display: 'flex', flexFlow: 'column', gap: '5px' }}
      >
        <Alert severity="info">
          {shareAll ? (
            <>
              <span>All bookmarks will be shared.</span>
              <br />
              <span>
                Use the checkboxes to select individual bookmarks to share.
              </span>
            </>
          ) : (
            'Only selected bookmarks will be shared.'
          )}
        </Alert>
        <DialogContentText>
          Copy the URL below to share your bookmarks.
        </DialogContentText>
        {error ? (
          <ErrorMessage error={error} />
        ) : loading ? (
          <Typography>Generating short URL...</Typography>
        ) : (
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
        )}
        <DialogContentText>
          The URL should be pasted into the "Import from share link" field in
          the "Import" form found in the "Bookmarked regions" drawer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          className={classes.flexItem}
          data-testid="dialogShare"
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={<ContentCopyIcon />}
          onClick={async () => {
            copy(url)
            session.notify('Copied to clipboard', 'success')
            onClose()
          }}
        >
          Copy share link
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ShareBookmarksDialog
