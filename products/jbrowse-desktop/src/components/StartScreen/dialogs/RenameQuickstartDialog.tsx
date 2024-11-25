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

const RenameQuickstartDialog = ({
  quickstartNames,
  quickstartToRename,
  onClose,
}: {
  quickstartNames: string[]
  quickstartToRename?: string
  onClose: (arg0: boolean) => void
}) => {
  const [newQuickstartName, setNewQuickstartName] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <Dialog
      open={!!quickstartToRename}
      onClose={() => {
        onClose(false)
      }}
      title="Rename quickstart"
    >
      <DialogContent>
        <DialogContentText>
          Please enter a new name for the session:
        </DialogContentText>
        {quickstartNames.includes(newQuickstartName) ? (
          <DialogContentText color="error">
            There is already a session named &quot;{newQuickstartName}&quot;
          </DialogContentText>
        ) : null}
        <Input
          autoFocus
          defaultValue={quickstartToRename}
          onChange={event => {
            setNewQuickstartName(event.target.value)
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
                'renameQuickstart',
                quickstartToRename,
                newQuickstartName,
              )
              onClose(true)
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
          color="primary"
          variant="contained"
          disabled={
            !quickstartToRename || quickstartNames.includes(newQuickstartName)
          }
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RenameQuickstartDialog
