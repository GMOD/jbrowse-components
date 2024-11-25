import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogContent, DialogActions, TextField } from '@mui/material'

export const ExternalTokenEntryForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (token?: string) => void
}) => {
  const [token, setToken] = useState('')

  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="externalToken-form"
      title={`Enter token for ${internetAccountId}`}
    >
      <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
        <TextField
          required
          label="Enter Token"
          variant="outlined"
          onChange={event => {
            setToken(event.target.value)
          }}
          margin="dense"
          slotProps={{
            htmlInput: { 'data-testid': 'entry-externalToken' },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={!token}
          onClick={() => {
            if (token) {
              handleClose(token)
            }
          }}
        >
          Add
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
    </Dialog>
  )
}
