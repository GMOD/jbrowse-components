import React, { useState } from 'react'
import path from 'path'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { ipcRenderer } from 'electron'
import { createPluginManager } from './util'

const useStyles = makeStyles(theme => ({
  button: {
    margin: theme.spacing(4),
  },
  note: {
    margin: theme.spacing(4),
  },
}))
const DeleteSessionDialog = ({
  onClose,
  setPluginManager,
}: {
  setPluginManager: Function
  onClose: () => void
}) => {
  const classes = useStyles()
  const [file, setFile] = useState<File>()
  const [error, setError] = useState<Error>()

  return (
    <Dialog open onClose={() => onClose()}>
      <DialogTitle>Open jbrowse-web config</DialogTitle>
      <DialogContent>
        <Typography>
          Use this form to open a pre-existing config.json from the jbrowse-web
          app.
        </Typography>
        <Typography className={classes.note}>
          Note: This file will won't be modified, it'll be copied to a new file
        </Typography>

        {error ? (
          <Typography variant="h6" color="error">{`${error}`}</Typography>
        ) : null}
        <Button variant="contained" color="primary" className={classes.button}>
          Select config.json
          <input
            type="file"
            hidden
            onChange={event => {
              const target = event.target
              setFile(target.files?.[0])
            }}
          />
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="secondary" variant="contained">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            if (!file) {
              return
            }
            try {
              const baseUri = path.dirname(file.path)
              const pm = await createPluginManager(
                JSON.parse(
                  await ipcRenderer.invoke('loadExternalConfig', file.path),
                  function (k, v) {
                    if (k === 'uri' && !v.match(/https?:\/\//)) {
                      this.localPath = path.join(baseUri, v)
                      return
                    }
                    return v
                  },
                ),
              )

              setPluginManager(pm)
              onClose()
            } catch (e) {
              setError(e)
              console.error(e)
            }
          }}
          color="primary"
          variant="contained"
          disabled={!file}
          autoFocus
        >
          Open
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DeleteSessionDialog
