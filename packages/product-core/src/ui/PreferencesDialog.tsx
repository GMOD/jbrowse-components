import { Suspense, useState } from 'react'

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

import { DISPLAY_TYPE_DEFAULTS_PATH_HEAD } from '../Session/BaseSession.ts'
import PreferencesResetDialog from './PreferencesResetDialog.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ThemeMap } from '@jbrowse/core/ui'
import type { AnimationMode, TrackConfigChange } from '@jbrowse/core/util'
import type React from 'react'

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
  effectiveUseWorkspaces: boolean
  setUseWorkspaces: (useWorkspaces: boolean) => void
  resetUseWorkspaces: () => void
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

// The preference subsystems whose reset doesn't reduce to dropping a key from
// the session override map — theme and the two layout flags, each its own mixin
// with its own default. Defined once here so the reset diff (`change`) and the
// reset actions (`resetAllPreferences`, `resetPreferenceChange`) can't
// enumerate them differently: `head` both tags the change row and routes its
// reset, so a row always reverts through the same descriptor that produced it.
// The preference-override map (animationMode, scrollZoom, promoted display-type
// defaults) is enumerated separately by the session.
interface PreferenceSubsystem {
  head: string
  // the change row when this subsystem differs from its default, else
  // undefined. Omitted by useWorkspaces, which lives in both stores: the
  // override map already reports its row, so this entry only routes the reset,
  // which must clear the session property too.
  change?: (session: PreferencesDialogSession) => TrackConfigChange | undefined
  reset: (session: PreferencesDialogSession) => void
}

const PREFERENCE_SUBSYSTEMS: PreferenceSubsystem[] = [
  {
    head: 'theme',
    change: s =>
      s.themeName && s.themeName !== 'default'
        ? { path: ['theme'], from: 'default', to: s.themeName }
        : undefined,
    reset: s => {
      s.setThemeName('default')
    },
  },
  {
    head: 'stickyViewHeaders',
    change: s =>
      s.stickyViewHeaders
        ? undefined
        : { path: ['stickyViewHeaders'], from: true, to: false },
    reset: s => {
      s.setStickyViewHeaders(true)
    },
  },
  {
    head: 'useWorkspaces',
    reset: s => {
      s.resetUseWorkspaces()
    },
  },
]

// every preference that currently differs from its default, so the confirmation
// dialog shows the full effect of a reset: the session override map plus each
// non-map subsystem above.
function collectPreferenceChanges(
  session: PreferencesDialogSession,
): TrackConfigChange[] {
  return [
    ...session.getPreferenceChanges(),
    ...PREFERENCE_SUBSYSTEMS.map(p => p.change?.(session)).filter(
      c => c !== undefined,
    ),
  ]
}

// Reset every preference this dialog exposes back to its default: clear the
// whole override map (scrollZoom, animationMode, all promoted display-type
// defaults) at once, then reset each non-map subsystem through its own setter.
function resetAllPreferences(session: PreferencesDialogSession) {
  session.clearPreferenceOverrides()
  for (const p of PREFERENCE_SUBSYSTEMS) {
    p.reset(session)
  }
}

// Revert a single change row (see `collectPreferenceChanges`) to its default,
// routing to the subsystem that owns it: a non-map subsystem by matching `head`,
// a promoted per-display-type default through `setDisplayTypeDefault(...
// undefined)`, and every other row as a scalar override dropped from the map by
// key.
function resetPreferenceChange(
  session: PreferencesDialogSession,
  change: TrackConfigChange,
) {
  const [head, displayType, slot] = change.path
  const subsystem = PREFERENCE_SUBSYSTEMS.find(p => p.head === head)
  if (subsystem) {
    subsystem.reset(session)
  } else if (head === DISPLAY_TYPE_DEFAULTS_PATH_HEAD && displayType && slot) {
    session.setDisplayTypeDefault(displayType, slot, undefined)
  } else if (head) {
    session.clearPreferenceOverride(head)
  }
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
            control={<Checkbox checked={session.effectiveUseWorkspaces} />}
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
            resetAllPreferences(session)
          }}
          onResetRow={change => {
            resetPreferenceChange(session, change)
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
