import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { toBase64 } from '@jbrowse/core/util'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { CredentialDestination } from '../CredentialDestination.tsx'

export const HTTPBasicLoginForm = observer(function HTTPBasicLoginForm({
  internetAccountId,
  domains,
  handleClose,
}: {
  internetAccountId: string
  domains: string[]
  handleClose: (arg?: string) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <SubmitDialog
      open
      maxWidth="xl"
      data-testid="login-httpbasic"
      title={`Log in for ${internetAccountId}`}
      // an incomplete submit used to close as if cancelled, which the account
      // reports as "User cancelled entry" — a failed login the user never made
      submitDisabled={!username || !password}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        // UTF-8, per RFC 7617: btoa throws on anything past Latin-1
        handleClose(
          toBase64(new TextEncoder().encode(`${username}:${password}`)),
        )
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <CredentialDestination domains={domains} />
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
      </div>
    </SubmitDialog>
  )
})
