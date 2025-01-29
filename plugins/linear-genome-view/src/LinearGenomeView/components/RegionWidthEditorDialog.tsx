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

import type { LinearGenomeViewModel } from '../model'

const toP = (s = 0) => +(+s).toFixed(1)

const RegionWidthEditorDialog = observer(function ({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const [val, setVal] = useState(`${toP(model.bpPerPx)}`)
  return (
    <Dialog title="Edit zoom level" open onClose={handleClose}>
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 30 }}
      >
        <Typography>
          Allows editing the zoom level using the 'base pairs per pixel'
          measurement
        </Typography>
        <Typography>
          Large numbers e.g. 10 means there are 10 base pairs in each pixel,
          small numbers e.g. 0.1 means there are 10 pixels for each base pair
        </Typography>
        <TextField
          helperText="current bpPerPx"
          value={val}
          onChange={event => {
            setVal(event.target.value)
          }}
        />
        Resulting region width: approximatly{' '}
        {!Number.isNaN(+val) ? model.width / +val : '(error parsing number)'}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            model.zoomTo(+val)
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default RegionWidthEditorDialog
