import React, { useState } from 'react'
import { observer } from 'mobx-react'

import {
  Button,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import GetAppIcon from '@mui/icons-material/GetApp'

import { GridBookmarkModel } from '../model'
import { downloadBookmarkFile } from '../utils'
import { getSession } from '@jbrowse/core/util'

import { ContentCopy as ContentCopyIcon } from '@jbrowse/core/ui/Icons'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
}))

function ExportBookmarks({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fileType, setFileType] = useState('BED')
  const { bookmarkedRegions } = model
  const session = getSession(model)

  return (
    <>
      <Button startIcon={<GetAppIcon />} onClick={() => setDialogOpen(true)}>
        Export
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Export bookmarks"
      >
        <DialogContent style={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">Format to download:</Typography>
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
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={() => {
              // shareSession(session)
              // TODO: implement
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
              downloadBookmarkFile(bookmarkedRegions, fileType, model)
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
