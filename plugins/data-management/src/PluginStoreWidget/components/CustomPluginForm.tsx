import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

import { makeStyles } from '@material-ui/core/styles'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'

import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

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
  onClose: Function
  model: PluginStoreModel
}) {
  const classes = useStyles()
  const [pluginUrl, setPluginUrl] = useState<string>()

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPluginUrl(event.target.value)
  }

  const rootModel = getRoot(model)
  const { jbrowse } = rootModel

  const handleSubmit = () => {
    jbrowse.addPlugin({ url: pluginUrl })
  }

  return (
    <Dialog open={open} onClose={() => onClose(false)}>
      <DialogTitle>
        <IconButton
          className={classes.closeDialog}
          aria-label="close-dialog"
          onClick={() => onClose(false)}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <div className={classes.dialogContainer}>
        <TextField
          id="url-input"
          name="url"
          label="Plugin URL"
          variant="outlined"
          value={pluginUrl}
          onChange={handleChange}
          multiline
        />
        <Button
          variant="contained"
          color="primary"
          style={{ marginTop: '1.5rem' }}
          onClick={handleSubmit}
          disabled={!pluginUrl}
        >
          Add plugin
        </Button>
      </div>
    </Dialog>
  )
}

export default observer(CustomPluginForm)
