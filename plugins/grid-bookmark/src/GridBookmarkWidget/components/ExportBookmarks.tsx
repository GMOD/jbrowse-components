import React, { useState } from 'react'
import { observer } from 'mobx-react'

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
import { Dialog } from '@jbrowse/core/ui'

// locals
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
  const { selectedBookmarks } = model
  const exportAll = selectedBookmarks.length === 0

  return (
    <>
      <Button
        startIcon={<GetAppIcon />}
        onClick={() => setDialogOpen(true)}
        data-testid="export_button"
      >
        Export
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Export bookmarks"
      >
        <DialogContent
          style={{ display: 'flex', flexFlow: 'column', gap: '5px' }}
        >
          <Alert severity="info">
            {exportAll
              ? 'All bookmarks will be exported'
              : 'Only selected bookmarks will be exported.'}
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
