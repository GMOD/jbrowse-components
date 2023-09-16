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

import { getSession } from '@jbrowse/core/util'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

// locals
import { GridBookmarkModel } from '../model'
import { shareSessionToDynamo } from '../sessionSharing'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
}))

const ShareBookmarks = observer(function ShareBookmarks({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
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
        session.notify(`${e}`, 'error')
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bookmarksToShare, session])

  return (
    <>
      <Button
        disabled={loading}
        startIcon={<ContentCopyIcon />}
        onClick={() => setDialogOpen(true)}
      >
        Share
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Share bookmarks"
      >
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
        </DialogContent>
        <DialogActions>
          <Button
            className={classes.flexItem}
            data-testid="dialogShare"
            variant="contained"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              copy(url)
              session.notify('Copied to clipboard', 'success')
              setDialogOpen(false)
            }}
          >
            Copy share link to clipboard
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
})

export default ShareBookmarks
