import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'

export default function SetRowHeight({
  model,
  handleClose,
}: {
  model: {
    rowHeight: number
    setRowHeight: (arg: number | 'auto') => void
  }
  handleClose: () => void
}) {
  const [value, setValue] = useState<string>(`${model.rowHeight}`)

  return (
    <Dialog open title="Set row height" onClose={handleClose}>
      <DialogContent>
        <TextField
          value={value}
          onChange={event => {
            setValue(event.target.value)
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          disabled={Number.isNaN(+value)}
          variant="contained"
          onClick={() => {
            model.setRowHeight(+value)
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
    </Dialog>
  )
}
