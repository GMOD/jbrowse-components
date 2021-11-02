import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

import {
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

// icons
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

// locals
import { PluginStoreModel } from '../model'

const useStyles = makeStyles(() => ({
  closeDialog: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialogContainer: {
    margin: 15,
    display: 'flex',
    flexDirection: 'column',
  },
}))

function CustomPluginForm({
  open,
  onClose,
  model,
}: {
  open: boolean
  onClose: () => void
  model: PluginStoreModel
}) {
  const classes = useStyles()
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const rootModel = getRoot(model)
  const { jbrowse } = rootModel

  return (
    <Dialog open={open} onClose={() => onClose()}>
      <DialogTitle>
        Add custom plugin
        <IconButton className={classes.closeDialog} onClick={() => onClose()}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <div className={classes.dialogContainer}>
          <Typography>
            Specify the name and URL path of your plugin source
          </Typography>
          <TextField
            id="name-input"
            name="name"
            label="Plugin name"
            variant="outlined"
            value={formName}
            onChange={event => setFormName(event.target.value)}
          />
          <TextField
            id="url-input"
            name="url"
            label="Plugin URL"
            variant="outlined"
            value={formUrl}
            onChange={event => setFormUrl(event.target.value)}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={() => onClose()}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            jbrowse.addPlugin({ name: formName, url: formUrl })
            onClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(CustomPluginForm)
