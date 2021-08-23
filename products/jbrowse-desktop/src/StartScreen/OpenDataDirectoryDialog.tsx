import React, { useState } from 'react'
import path from 'path'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@material-ui/core'
import { ipcRenderer } from 'electron'
import { createPluginManager } from './util'

// function replaceUrisWithLocalPath(obj) {

// }

const DeleteSessionDialog = ({
  onClose,
  setPluginManager,
}: {
  setPluginManager: Function
  onClose: () => void
}) => {
  const [file, setFile] = useState<File>()
  const [error, setError] = useState<Error>()

  return (
    <Dialog open onClose={() => onClose()}>
      <DialogTitle>Open existing config</DialogTitle>
      <DialogContent>
        <Typography>
          Use this form to open a pre-existing config. This will be like a
          config.json from the JBrowse 2 web app.
        </Typography>
        {error ? (
          <Typography variant="h6" color="error">{`${error}`}</Typography>
        ) : null}
        <Button variant="contained" component="label">
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
