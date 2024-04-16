import React from 'react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  TextField,
  ThemeOptions,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { Dialog } from '@jbrowse/core/ui'

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
    stickyMode?: boolean
    allThemes: () => Record<string, ThemeOptions & { name?: string }>
    themeName?: string
    setThemeName: (arg: string) => void
    setStickyModel: (arg: boolean) => void
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
        <FormControlLabel
          control={
            <Checkbox
              value={session.stickyMode}
              onChange={event => session.setStickyMode(event.target.checked)}
            />
          }
          label="Sticky view headers"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
