import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

function ColorByCustomDlg(props: {
  model: { setColorScheme: Function }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [expr, setExpr] = useState('')

  return (
    <Dialog open onClose={handleClose} title="Apply custom color scheme">
      <DialogContent style={{ overflowX: 'hidden', width: '30pc' }}>
        <Typography>Enter a custom jexl callback: </Typography>
        <TextField
          value={expr}
          onChange={event => setExpr(event.target.value)}
          placeholder={`jexl:get(feature,"myProperty") == "value" ? "red" : "blue"`}
          fullWidth
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              model.setColorScheme({
                type: 'custom',
                expr: expr,
              })
              handleClose()
            }}
            disabled={expr === ''}
          >
            Submit
          </Button>
          <Button variant="contained" color="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

export default observer(ColorByCustomDlg)
