import React, { useState } from 'react'
import { observer } from 'mobx-react'

import Button from '@mui/material/Button'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Typography from '@mui/material/Typography'
import { makeStyles } from 'tss-react/mui'

// icons
import GetAppIcon from '@mui/icons-material/GetApp'

import { GridBookmarkModel } from '../model'
import { downloadBookmarkFile } from '../utils'

const useStyles = makeStyles()(() => ({
  flexItem: {
    margin: 5,
  },
  flexContainer: {
    display: 'flex',
    justifyContent: 'space-evenly',
    width: 200,
  },
}))

function DownloadBookmarks({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fileType, setFileType] = useState('BED')
  const { bookmarkedRegions } = model

  return (
    <>
      <Button startIcon={<GetAppIcon />} onClick={() => setDialogOpen(true)}>
        Download
      </Button>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Download bookmarks"
      >
        <DialogContent>
          <Typography>Format to download</Typography>
          <Select
            className={classes.flexItem}
            data-testid="selectFileType"
            value={fileType}
            onChange={event => setFileType(event.target.value as string)}
          >
            <MenuItem value="BED">BED</MenuItem>
            <MenuItem value="TSV">TSV</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setDialogOpen(false)}
          >
            Cancel
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

export default observer(DownloadBookmarks)
