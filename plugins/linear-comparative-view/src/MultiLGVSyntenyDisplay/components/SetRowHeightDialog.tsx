import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const SetRowHeightDialog = observer(function SetRowHeightDialog(props: {
  model: {
    setRowHeight: (h: number) => void
    rowHeight: number
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [height, setHeight] = useState(`${model.rowHeight}`)

  const ok = height !== '' && !Number.isNaN(+height) && +height > 0

  return (
    <Dialog open onClose={handleClose} title="Set row height">
      <DialogContent>
        <Typography>Set a custom row height in pixels per genome.</Typography>
        <TextField
          value={height}
          helperText="Row height (px)"
          onChange={event => {
            setHeight(event.target.value)
          }}
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
            disabled={!ok}
            onClick={() => {
              model.setRowHeight(+height)
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default SetRowHeightDialog
