import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Snackbar from '@material-ui/core/Snackbar'
import React, { useState } from 'react'

export default function ErrorSnackbar({ error }: { error?: Error }) {
  const [open, setOpen] = useState(true)

  return (
    <Snackbar
      open={open}
      onClose={() => {
        setOpen(false)
      }}
      message={
        <span style={{ display: 'flex' }}>
          <div>{error ? error.toString() : null} </div>
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
