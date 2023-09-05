import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'

import {
  Button,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  Typography,
  Alert,
} from '@mui/material'
import GetAppIcon from '@mui/icons-material/GetApp'
import { makeStyles } from 'tss-react/mui'
import copy from 'copy-to-clipboard'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'
import { shareSessionToDynamo } from '@jbrowse/web/src/sessionSharing'

// ålocals
import { GridBookmarkModel } from '../model'
import { downloadBookmarkFile } from '../utils'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
}))

function ExportBookmarks({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fileType, setFileType] = useState('BED')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const session = getSession(model)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoading(true)
        const snap = getSnapshot(model.sharedBookmarksModel)

        const locationUrl = new URL(window.location.href)
        const result = await shareSessionToDynamo(
          snap,
          session.shareURL,
          locationUrl.href,
        )
        if (!cancelled) {
          const params = new URLSearchParams(locationUrl.search)
          params.set('session', `share-${result.json.sessionId}`)
          params.set('password', result.password)
          locationUrl.search = params.toString()
          setUrl(locationUrl.href)
          setLoading(false)
        }
      } catch (e) {
        session.notify(`${e}`, 'error')
      } finally {
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dialogOpen, model.sharedBookmarksModel, session])

  return (
    <>
      <Button
        startIcon={<GetAppIcon />}
        onClick={() => setDialogOpen(true)}
        disabled={model.selectedBookmarks.length === 0}
      >
        Export
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Export selected bookmarks"
      >
        <DialogContent
          style={{ display: 'flex', flexFlow: 'column', gap: '5px' }}
        >
          <Alert severity="info">
            Only selected bookmarks will be exported.
          </Alert>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography>Format to download:</Typography>
            <Select
              size="small"
              className={classes.flexItem}
              data-testid="selectFileType"
              value={fileType}
              onChange={event => setFileType(event.target.value)}
            >
              <MenuItem value="BED">BED</MenuItem>
              <MenuItem value="TSV">TSV</MenuItem>
            </Select>
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            disabled={loading}
            startIcon={<ContentCopyIcon />}
            onClick={async () => {
              copy(url)
              session.notify('Copied to clipboard', 'success')
            }}
          >
            Copy share link to clipboard
          </Button>
          <Button
            className={classes.flexItem}
            data-testid="dialogDownload"
            variant="contained"
            color="primary"
            startIcon={<GetAppIcon />}
            onClick={() => {
              downloadBookmarkFile(fileType, model)
              setDialogOpen(false)
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default observer(ExportBookmarks)
