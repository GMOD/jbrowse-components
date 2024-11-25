import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Input,
  Typography,
} from '@mui/material'
const { ipcRenderer } = window.require('electron')

const RenameSessionDialog = ({
  sessionToRename,
  onClose,
}: {
  sessionToRename?: { path: string; name: string }
  onClose: (arg0: boolean) => void
}) => {
  const [newSessionName, setNewSessionName] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <Dialog
      open
      onClose={() => {
        onClose(false)
      }}
      title="Rename session"
    >
      <DialogContent>
        <DialogContentText>
          Please enter a new name for the session:
        </DialogContentText>
        <Input
          autoFocus
          defaultValue={sessionToRename?.name}
          onChange={event => {
            setNewSessionName(event.target.value)
          }}
        />
        {error ? (
          <Typography color="error" variant="h6">{`${error}`}</Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose(false)
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              await ipcRenderer.invoke(
                'renameSession',
                sessionToRename?.path,
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
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RenameSessionDialog
