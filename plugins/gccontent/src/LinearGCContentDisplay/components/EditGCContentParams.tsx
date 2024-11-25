import React, { useState } from 'react'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const EditGCContentParamsDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    windowSizeSetting: number
    windowDeltaSetting: number
    setGCContentParams: (a: { windowSize: number; windowDelta: number }) => void
  }
  handleClose: () => void
}) {
  const [windowSize, setWindowSize] = useState(`${model.windowSizeSetting}`)
  const [windowDelta, setWindowDelta] = useState(`${model.windowDeltaSetting}`)

  return (
    <Dialog open onClose={handleClose} title="Edit GC content params">
      <DialogContent>
        <Typography>
          GC content is calculated in a particular sliding window of size N, and
          then the sliding window moves (steps) some number of bases M forward.
          Note that small step sizes can result in high CPU over large areas,
          and it is not recommended to make the step size larger than the window
          size as then the sliding window will miss contents.
        </Typography>
        {+windowDelta > +windowSize ? (
          <ErrorMessage error="It is not recommended to make the step size larger than the window size" />
        ) : null}
        <TextField
          label="Size of sliding window (bp)"
          value={windowSize}
          onChange={event => {
            setWindowSize(event.target.value)
          }}
        />
        <TextField
          label="Step size of sliding window (bp)"
          value={windowDelta}
          onChange={event => {
            setWindowDelta(event.target.value)
          }}
        />

        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              model.setGCContentParams({
                windowSize: +windowSize,
                windowDelta: +windowDelta,
              })
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

export default EditGCContentParamsDialog
