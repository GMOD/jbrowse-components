import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { downloadBookmarkFile } from '../../utils'

import type { GridBookmarkModel } from '../../model'

const useStyles = makeStyles()({
  flexItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  container: {
    display: 'flex',
    flexFlow: 'column',
    gap: '5px',
  },
})

const ExportBookmarksDialog = observer(function ({
  model,
  onClose,
}: {
  model: GridBookmarkModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [fileType, setFileType] = useState('BED')
  const { selectedBookmarks } = model
  const exportAll = selectedBookmarks.length === 0
  return (
    <Dialog
      open
      title="Export bookmarks"
      onClose={() => {
        onClose()
      }}
    >
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
        <div className={classes.flexItem}>
          <Typography>Format to download:</Typography>
          <Select
            size="small"
            value={fileType}
            onChange={event => {
              setFileType(event.target.value)
            }}
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
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            downloadBookmarkFile(fileType, model)
            onClose()
          }}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  )
})
export default ExportBookmarksDialog
