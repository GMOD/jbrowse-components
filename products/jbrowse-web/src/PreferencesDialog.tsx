import React from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
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
  session: { themeName?: string; setThemeName: (arg: string) => void }
}) {
  const { classes } = useStyles()
  return (
    <Dialog title="Preferences" open onClose={handleClose} maxWidth="xl">
      <DialogContent className={classes.container}>
        <TextField
          select
          label="Theme"
          value={session.themeName || 'default'}
          onChange={event => session.setThemeName(event.target.value)}
        >
          {Object.entries(session.getThemes()).map(([key, val]) => (
            <MenuItem value={key}>{val.name}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
