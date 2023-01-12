import React from 'react'
import { observer } from 'mobx-react'
import { assembleLocString } from '@jbrowse/core/util'
import Button from '@mui/material/Button'
import Dialog from '@jbrowse/core/ui/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'

import { GridBookmarkModel } from '../model'

function DeleteBookmarkDialog({
  rowNumber,
  model,
  onClose,
}: {
  rowNumber: number | undefined
  model: GridBookmarkModel
  onClose: () => void
}) {
  const { removeBookmark } = model

  return (
    <Dialog
      open={rowNumber !== undefined}
      onClose={onClose}
      title="Delete bookmark"
    >
      <DialogContent>
        <Typography>
          Remove{' '}
          <code>
            {rowNumber !== undefined
              ? assembleLocString(model.bookmarkedRegions[rowNumber])
              : ''}
          </code>{' '}
          ?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (rowNumber !== undefined) {
              removeBookmark(rowNumber)
              onClose()
            }
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(DeleteBookmarkDialog)
