import { Suspense } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  Divider,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ThemeOptions } from '@mui/material'
import type React from 'react'

const useStyles = makeStyles()({
  container: {
    width: 800,
  },
  panelHeading: {
    marginTop: 16,
  },
})

export interface PreferencesDialogSession {
  allThemes: () => Record<string, ThemeOptions & { name?: string }>
  themeName?: string
  setThemeName: (arg: string) => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  useWorkspaces: boolean
  setUseWorkspaces: (useWorkspaces: boolean) => void
}

/**
 * Descriptor returned from the `Core-preferencesDialogPanels` extension point.
 * Each panel renders as its own labeled section in the dialog.
 */
export interface PreferencesPanelDescriptor {
  name: string
  Component: React.ComponentType<{ session: PreferencesDialogSession }>
}

const PreferencesDialog = observer(function PreferencesDialog({
  handleClose,
  session,
  pluginManager,
}: {
  handleClose: () => void
  session: PreferencesDialogSession
  pluginManager: PluginManager
}) {
  const { classes } = useStyles()
  const extraPanels = pluginManager.evaluateExtensionPoint(
    'Core-preferencesDialogPanels',
    [] as PreferencesPanelDescriptor[],
    { session },
  ) as PreferencesPanelDescriptor[]
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
        </FormGroup>
        {extraPanels.map(({ name, Component }) => (
          <div key={name}>
            <Divider />
            <Typography variant="subtitle1" className={classes.panelHeading}>
              {name}
            </Typography>
            <Suspense fallback={null}>
              <Component session={session} />
            </Suspense>
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose()}>Close</Button>
      </DialogActions>
    </Dialog>
  )
})

export default PreferencesDialog
