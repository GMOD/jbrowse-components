import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const SetMaxHeightDialog = observer(function SetMaxHeightDialog(props: {
  model: {
    maxHeight?: number
    setMaxHeight: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const { maxHeight = '' } = model
  const [max, setMax] = useState(`${maxHeight}`)

  function onSubmit() {
    model.setMaxHeight(max !== '' && !Number.isNaN(+max) ? +max : undefined)
    handleClose()
  }

  return (
    <Dialog open onClose={handleClose} title="Set max track height">
      <form
        onSubmit={event => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <DialogContent className={classes.root}>
          <Typography>
            Set max layout height for the track. For example, you can increase
            this if the layout says &quot;Max height reached&quot;
          </Typography>
          <TextField
            value={max}
            autoFocus
            onChange={event => {
              setMax(event.target.value)
            }}
            placeholder="Enter max height for layout"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" type="submit">
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
      </form>
    </Dialog>
  )
})
export default SetMaxHeightDialog
