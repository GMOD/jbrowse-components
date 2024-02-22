import React, { useState } from 'react'
import { Button, DialogContent, DialogActions, TextField } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

export function HTTPBasicLoginForm({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <Dialog
      open
      maxWidth="xl"
      data-testid="login-httpbasic"
      title={`Log in for ${internetAccountId}`}
    >
      <form
        onSubmit={event => {
          if (username && password) {
            handleClose(btoa(`${username}:${password}`))
          } else {
            handleClose()
          }
          event.preventDefault()
        }}
      >
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Username"
            variant="outlined"
            inputProps={{ 'data-testid': 'login-httpbasic-username' }}
            onChange={event => setUsername(event.target.value)}
            margin="dense"
          />
          <TextField
            required
            label="Password"
            type="password"
            autoComplete="current-password"
            variant="outlined"
            inputProps={{ 'data-testid': 'login-httpbasic-password' }}
            onChange={event => setPassword(event.target.value)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" type="submit">
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            type="submit"
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
