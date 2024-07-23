import React from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  ThemeOptions,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Dialog } from '@jbrowse/core/ui'

const useStyles = makeStyles()(() => ({
  container: {
    width: 800,
    display: 'flex',
    gap: '5px',
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
    themeMode: string
    setThemeMode: (arg: string) => void
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
          onChange={event => session.setThemeName(event.target.value)}
        >
          {Object.entries(session.allThemes()).map(([key, val]) => (
            <MenuItem key={key} value={key}>
              {val.name || '(Unknown name)'}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Mode"
          value={session.themeMode}
          onChange={event => session.setThemeMode(event.target.value)}
        >
          <MenuItem value={'light'}>Light</MenuItem>
          <MenuItem value={'dark'}>Dark</MenuItem>
          <MenuItem value={'system'}>System</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
