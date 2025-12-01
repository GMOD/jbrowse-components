import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { ThemeOptions } from '@mui/material'

const useStyles = makeStyles()(() => ({
  container: {
    width: 800,
  },
}))

const PreferencesDialog = observer(function ({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: {
    allThemes: () => Record<string, ThemeOptions & { name?: string }>
    themeName?: string
    stickyViewHeaders: boolean
    setStickyViewHeaders(sticky: boolean): void
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
        <FormGroup>
          <FormControlLabel
            control={<Checkbox checked={session.stickyViewHeaders} />}
            onChange={(_, checked) => {
              session.setStickyViewHeaders(checked)
            }}
            label="Keep view header visible"
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
})

export default PreferencesDialog
