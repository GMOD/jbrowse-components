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
import { makeStyles } from 'tss-react/mui'
import { Dialog } from '@jbrowse/core/ui'

// Icons
import GetAppIcon from '@mui/icons-material/GetApp'

// locals
import { GridBookmarkModel } from '../../model'
import { downloadBookmarkFile } from '../../utils'

const useStyles = makeStyles()({
  flexItem: {
    margin: 5,
  },
  container: {
    display: 'flex',
    flexFlow: 'column',
    gap: '5px',
  },
})

const ExportBookmarksDialog = observer(function ExportBookmarksDialog({
  model,
  onClose,
}: {
  model: GridBookmarkModel
  onClose: (arg: boolean) => void
}) {
  const { classes } = useStyles()
  const [fileType, setFileType] = useState('BED')
  const { selectedBookmarks } = model
  const exportAll = selectedBookmarks.length === 0
  return (
    <Dialog open onClose={onClose} title="Export bookmarks">
      <DialogContent className={classes.container}>
        <Alert severity="info">
          {exportAll ? (
            <>
              <span>All bookmarks will be exported.</span>
              <br />
              <span>
                Use the checkboxes to select individual bookmarks to export.
              </span>
            </>
          ) : (
            'Only selected bookmarks will be exported.'
          )}
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
          color="primary"
          startIcon={<GetAppIcon />}
          onClick={() => {
            downloadBookmarkFile(fileType, model)
            onClose(false)
          }}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  )
})
export default ExportBookmarksDialog
