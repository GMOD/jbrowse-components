import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import type { ThemeOptions } from '@mui/material'

const useStyles = makeStyles()(() => ({
  container: {
    width: 800,
  },
}))

export default function PreferencesDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: {
    allThemes: () => Record<string, ThemeOptions & { name?: string }>
    themeName?: string
    setThemeName: (arg: string) => void
  }
}) {
  const { classes } = useStyles()
  return (
    <Dialog title="Preferences" open onClose={handleClose} maxWidth="xl">
      <DialogContent className={classes.container}>
        <TextField
          select
          label="Theme"
          value={session.themeName}
          onChange={event => {
            session.setThemeName(event.target.value)
          }}
        >
          {Object.entries(session.allThemes()).map(([key, val]) => (
            <MenuItem key={key} value={key}>
              {val.name || '(Unknown name)'}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
