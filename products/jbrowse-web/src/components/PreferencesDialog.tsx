import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeOptions } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  container: {
    width: 800,
  },
  shortcutSection: {
    marginTop: theme.spacing(3),
  },
  shortcutTable: {
    marginTop: theme.spacing(1),
  },
  keyCell: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
}))

const PreferencesDialog = observer(function PreferencesDialog({
  handleClose,
  session,
}: {
  handleClose: () => void
  session: {
    allThemes: () => Record<string, ThemeOptions & { name?: string }>
    themeName?: string
    setThemeName: (arg: string) => void
    stickyViewHeaders: boolean
    setStickyViewHeaders(sticky: boolean): void
    useWorkspaces: boolean
    setUseWorkspaces(useWorkspaces: boolean): void
    showMenuShortcuts: boolean
    setShowMenuShortcuts(show: boolean): void
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
            label="Keep view header visible"
            onChange={(_, checked) => {
              session.setStickyViewHeaders(checked)
            }}
          />
          <FormControlLabel
            control={<Checkbox checked={session.useWorkspaces} />}
            label="Use workspaces (tabbed/tiled view layout)"
            onChange={(_, checked) => {
              session.setUseWorkspaces(checked)
            }}
          />
          <FormControlLabel
            control={<Checkbox checked={session.showMenuShortcuts} />}
            label="Show keyboard shortcuts in menus"
            onChange={(_, checked) => {
              session.setShowMenuShortcuts(checked)
            }}
          />
        </FormGroup>

        <div className={classes.shortcutSection}>
          <Typography variant="h6">Keyboard Shortcuts</Typography>
          <Typography variant="body2" color="text.secondary">
            These shortcuts work when a Linear Genome View is focused (click on
            it first).
          </Typography>
          <Table size="small" className={classes.shortcutTable}>
            <TableHead>
              <TableRow>
                <TableCell>Shortcut</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className={classes.keyCell}>v</TableCell>
                <TableCell>Open view menu</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>Alt + ↓</TableCell>
                <TableCell>Focus next track</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>Alt + ↑</TableCell>
                <TableCell>Focus previous track</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>m</TableCell>
                <TableCell>Open focused track menu</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>Escape</TableCell>
                <TableCell>Clear track focus</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>+ / =</TableCell>
                <TableCell>Zoom in</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className={classes.keyCell}>-</TableCell>
                <TableCell>Zoom out</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, fontStyle: 'italic' }}
          >
            Tip: Menu items also show keyboard shortcuts. Press the shortcut key
            while a menu is open to activate that item.
          </Typography>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
})

export default PreferencesDialog
