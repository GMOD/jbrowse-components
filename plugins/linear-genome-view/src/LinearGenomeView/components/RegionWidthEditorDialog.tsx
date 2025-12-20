import { useEffect, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model'

const toP = (s = 0) => +s.toFixed(1)

const RegionWidthEditorDialog = observer(function ({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const { bpPerPx, width } = model
  const [val, setVal] = useState(toLocale(toP(bpPerPx * width)))
  useEffect(() => {
    setVal(toLocale(bpPerPx * width))
  }, [bpPerPx, width])
  const val2 = val.replace(/,/g, '')
  return (
    <Dialog title="Edit zoom level" open onClose={handleClose}>
      <DialogContent
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 30,
        }}
      >
        <Typography>
          Enter a specific number of base pairs to change the viewport to show.
          This is approximate and does not account for padding between regions
          or off-screen scrolling
        </Typography>
        <TextField
          helperText="current zoom level (in bp)"
          value={val}
          onChange={event => {
            setVal(event.target.value)
          }}
        />
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
            model.zoomTo(+val2 / model.width)
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
