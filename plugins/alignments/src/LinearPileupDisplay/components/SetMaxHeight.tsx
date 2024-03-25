import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetMaxHeightDialog = observer(function (props: {
  model: {
    maxHeight?: number
    setMaxHeight: Function
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)

  return (
    <Dialog open onClose={handleClose} title="Filter options">
      <DialogContent className={classes.root}>
        <Typography>
          Set max height for the track. For example, you can increase this if
          the layout says &quot;Max height reached&quot;
        </Typography>
        <TextField
          value={max}
          onChange={event => setMax(event.target.value)}
          placeholder="Enter max height for layout"
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          onClick={() => {
            model.setMaxHeight(
              max !== '' && !Number.isNaN(+max) ? +max : undefined,
            )
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})
export default SetMaxHeightDialog
