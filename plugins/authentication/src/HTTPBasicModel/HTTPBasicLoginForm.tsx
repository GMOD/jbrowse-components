import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogContent, DialogActions, TextField } from '@mui/material'

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
            onChange={event => {
              setUsername(event.target.value)
            }}
            margin="dense"
            slotProps={{
              htmlInput: { 'data-testid': 'login-httpbasic-username' },
            }}
          />
          <TextField
            required
            label="Password"
            type="password"
            autoComplete="current-password"
            variant="outlined"
            onChange={event => {
              setPassword(event.target.value)
            }}
            margin="dense"
            slotProps={{
              htmlInput: { 'data-testid': 'login-httpbasic-password' },
            }}
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
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
