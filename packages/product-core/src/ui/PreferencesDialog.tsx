import { Suspense, useState } from 'react'
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

import PreferencesResetDialog from './PreferencesResetDialog.tsx'
import { DTD_PATH_HEAD } from '../Session/BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ThemeMap } from '@jbrowse/core/ui'
import type { AnimationMode, TrackConfigChange } from '@jbrowse/core/util'

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
  clearPreferenceOverride: (key: string) => void
  clearPreferenceOverrides: () => void
  setDisplayTypeDefault: (
    displayType: string,
    slot: string,
    value: unknown,
  ) => void
  getPreferenceChanges: () => TrackConfigChange[]
}

// every preference that currently differs from the default `resetAllPreferences`
// reverts it to, across the three independent subsystems, so the confirmation
// dialog shows the full effect of a reset. The preference-override map
// (animationMode, scrollZoom, promoted display-type defaults) is enumerated by
// the session; the theme and the layout flags are read here since each is its
// own mixin with its own default.
function collectPreferenceChanges(
  session: PreferencesDialogSession,
): TrackConfigChange[] {
  const changes = [...session.getPreferenceChanges()]
  const { themeName } = session
  if (themeName && themeName !== 'default') {
    changes.push({ path: ['theme'], from: 'default', to: themeName })
  }
  if (!session.stickyViewHeaders) {
    changes.push({
      path: ['stickyViewHeaders'],
      from: true,
      to: session.stickyViewHeaders,
    })
  }
  if (session.useWorkspaces) {
    changes.push({
      path: ['useWorkspaces'],
      from: false,
      to: session.useWorkspaces,
    })
  }
  return changes
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
  // a confirmation dialog (showing the exact diff) guards the destructive reset,
  // instead of an accidental single click wiping every preference
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  // Reset every preference this dialog exposes back to its default. The three
  // subsystems persist independently, so each is reset through its own setter:
  // the whole override map (scrollZoom, animationMode, all promoted display-type
  // defaults), the theme, and the sticky-header/workspaces layout flags (whose
  // defaults `true`/`false` mirror their MultipleViews `types.optional`).
  function resetAllPreferences() {
    session.clearPreferenceOverrides()
    session.setThemeName('default')
    session.setStickyViewHeaders(true)
    session.setUseWorkspaces(false)
  }

  // Revert a single change row (see `collectPreferenceChanges`) to its default,
  // routing to the subsystem that owns that preference: the theme and the two
  // layout flags each have their own setter, a promoted per-display-type default
  // clears through `setDisplayTypeDefault(...undefined)`, and every other row is
  // a scalar override dropped from the override map by key.
  function resetPreferenceChange(change: TrackConfigChange) {
    const [head, displayType, slot] = change.path
    if (head === 'theme') {
      session.setThemeName('default')
    } else if (head === 'stickyViewHeaders') {
      session.setStickyViewHeaders(true)
    } else if (head === 'useWorkspaces') {
      session.setUseWorkspaces(false)
    } else if (head === DTD_PATH_HEAD && displayType && slot) {
      session.setDisplayTypeDefault(displayType, slot, undefined)
    } else if (head) {
      session.clearPreferenceOverride(head)
    }
  }

  const extraPanels = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-preferencesDialogPanels | sync | Add panels to the preferences dialog */
    'Core-preferencesDialogPanels',
    [],
    { session },
  )
  return (
    <Dialog title="Preferences" open onClose={handleClose} maxWidth="xl">
      <DialogContent className={classes.container}>
        <TextField
          select
          variant="outlined"
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
            variant="outlined"
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
          variant="contained"
          color="secondary"
          onClick={() => {
            setResetDialogOpen(true)
          }}
        >
          Reset to defaults…
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
      {resetDialogOpen ? (
        <PreferencesResetDialog
          changes={collectPreferenceChanges(session)}
          onReset={() => {
            resetAllPreferences()
          }}
          onResetRow={change => {
            resetPreferenceChange(change)
          }}
          onClose={() => {
            setResetDialogOpen(false)
          }}
        />
      ) : null}
    </Dialog>
  )
})

export default PreferencesDialog
