import { Suspense } from 'react'
import type React from 'react'

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
import type { ThemeMap } from '@jbrowse/core/ui'
import type { AnimationMode } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  container: {
    width: 800,
  },
  panelHeading: {
    marginTop: 16,
  },
  field: {
    marginTop: 16,
    display: 'block',
  },
})

export interface PreferencesDialogSession {
  allThemes: () => ThemeMap
  themeName?: string
  setThemeName: (arg: string) => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  useWorkspaces: boolean
  setUseWorkspaces: (useWorkspaces: boolean) => void
  animationMode: AnimationMode
  setPreferenceOverride: (key: string, value: unknown) => void
}

// declarative user-preference rows backed by the session preferences-override
// system (BaseSession getPreference/setPreferenceOverride). Add a row here to
// surface a new preference; resolution + persistence are already handled.
const PREFERENCE_SELECTS: {
  key: string
  label: string
  options: { value: string; label: string }[]
  get: (session: PreferencesDialogSession) => string
}[] = [
  {
    key: 'animationMode',
    label: 'Animations',
    options: [
      { value: 'system', label: 'Follow system (reduced motion)' },
      { value: 'enabled', label: 'Always on' },
      { value: 'disabled', label: 'Off' },
    ],
    get: session => session.animationMode,
  },
]

/**
 * Descriptor returned from the `Core-preferencesDialogPanels` extension point.
 * Each panel renders as its own labeled section in the dialog.
 */
export interface PreferencesPanelDescriptor {
  name: string
  Component: React.ComponentType<{ session: PreferencesDialogSession }>
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-preferencesDialogPanels': {
      args: PreferencesPanelDescriptor[]
      result: PreferencesPanelDescriptor[]
      props: { session: PreferencesDialogSession }
    }
  }
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
    [],
    { session },
  )
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
        {PREFERENCE_SELECTS.map(row => (
          <TextField
            key={row.key}
            select
            className={classes.field}
            label={row.label}
            value={row.get(session)}
            onChange={event => {
              session.setPreferenceOverride(row.key, event.target.value)
            }}
          >
            {row.options.map(opt => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        ))}
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
        <Button
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default PreferencesDialog
