import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Input,
  Typography,
} from '@material-ui/core'
import electron from 'electron'

const { ipcRenderer } = electron

const RenameSessionDialog = ({
  sessionNames,
  sessionToRename,
  onClose,
}: {
  sessionNames: string[]
  sessionToRename?: string
  onClose: (arg0: boolean) => void
}) => {
  const [newSessionName, setNewSessionName] = useState('')
  const [error, setError] = useState<Error>()

  return (
    <Dialog open={!!sessionToRename} onClose={() => onClose(false)}>
      <DialogTitle id="alert-dialog-title">Rename</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          Please enter a new name for the session:
        </DialogContentText>
        {sessionNames.includes(newSessionName) ? (
          <DialogContentText color="error">
            There is already a session named &quot;{newSessionName}&quot;
          </DialogContentText>
        ) : null}
        <Input
          autoFocus
          defaultValue={sessionToRename}
          onChange={event => setNewSessionName(event.target.value)}
        />
        {error ? (
          <Typography color="error" variant="h6">{`${error}`}</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)} color="primary">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke(
                'renameSession',
                sessionToRename,
                newSessionName,
              )
              onClose(true)
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
          color="primary"
          variant="contained"
          disabled={!newSessionName || sessionNames.includes(newSessionName)}
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RenameSessionDialog
