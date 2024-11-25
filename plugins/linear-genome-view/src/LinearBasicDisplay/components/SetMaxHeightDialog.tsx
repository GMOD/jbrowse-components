import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Typography,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetMaxHeightDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    maxHeight?: number
    setMaxHeight: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)
  const ok = max !== '' && !Number.isNaN(+max)
  return (
    <Dialog open onClose={handleClose} title="Set max height">
      <DialogContent className={classes.root}>
        <Typography>
          Set max height for the track. For example, you can increase this if
          the layout says &quot;Max height reached&quot;
        </Typography>
        <TextField
          value={max}
          onChange={event => {
            setMax(event.target.value)
          }}
          placeholder="Enter max score"
        />
        {!ok ? <div style={{ color: 'red' }}>Invalid number</div> : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          disabled={!ok}
          onClick={() => {
            model.setMaxHeight(+max)
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
})

export default SetMaxHeightDialog
