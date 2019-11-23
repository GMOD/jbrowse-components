import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import React, { useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MessageSnackbar({ session }: { session?: any }) {
  const [open, setOpen] = useState(true)

  return (
    <Snackbar
      open={open}
      onClose={() => {
        setOpen(false)
        session.setSnackbarMessage(undefined)
      }}
      message={
        <span style={{ display: 'flex' }}>
          <div>{session.snackbarMessage}</div>
          <IconButton
            key="close"
            aria-label="close"
            color="inherit"
            onClick={() => setOpen(false)}
          >
            <Icon>close</Icon>
          </IconButton>
        </span>
      }
    />
  )
}
