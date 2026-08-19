import { Suspense, useState } from 'react'

import { Dialog, LabeledCheckbox } from '@jbrowse/core/ui'
import {
  SCROLL_ZOOM_HELP,
  SCROLL_ZOOM_LABEL,
} from '@jbrowse/core/ui/scrollZoomLabels'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  Divider,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import DisplayDefaultsSection from './DisplayDefaultsSection.tsx'
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
  defaultUseWorkspaces: boolean
  setUseWorkspacesPreference: (useWorkspaces: boolean) => void
  resetUseWorkspaces: () => void
  animationMode: AnimationMode
  numberGrouping: boolean
  scrollZoom: boolean
  // not `setPreferenceOverride('scrollZoom', …)` like the rows below it: the
  // session's own setter also stops offering the scroll-to-zoom prompt, on the
  // grounds that whoever set this from here has plainly found the preference
  setScrollZoom: (flag: boolean) => void
  setPreferenceOverride: (key: string, value: unknown) => void
  clearPreferenceOverrides: () => void
  getPreferenceChanges: () => TrackConfigChange[]
  resetPreferenceChange: (path: string[]) => void
  getDisplayTypeDefaults: () => {
    displayType: string
    slot: string
    value: unknown
  }[]
  setDisplayTypeDefault: (
    displayType: string,
    slot: string,
    value: unknown,
  ) => void
}

// The preference subsystems whose reset doesn't reduce to dropping a key from
// the session override map — theme and the two layout flags, each its own mixin
// with its own default (useWorkspaces spans both: the map holds the user's
// override, the session model holds this session's explicit value). Defined
// once here so the reset diff (`change`) and the reset actions
// (`resetAllPreferences`, `resetPreferenceChange`) can't enumerate them
// differently: `head` both tags the change row and routes its reset, so a row
// always reverts through the same descriptor that produced it. The
// preference-override map (animationMode, scrollZoom, promoted display-type
// defaults) is enumerated separately by the session, minus these heads — a
// subsystem reports the *resolved* state, which is what its reset reverts.
interface PreferenceSubsystem {
  head: string
  // the change row when this subsystem differs from its default, else undefined
  change: (session: PreferencesDialogSession) => TrackConfigChange | undefined
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
    // the resolved flag against the admin default, not the override map's view
    // of it: a session-scoped value (a spec `layout`, "move view to a tab")
    // writes no override, so the map reported nothing to reset while
    // `resetUseWorkspaces` would plainly have turned workspaces back off —
    // leaving the confirmation empty and its Reset button disabled
    change: s =>
      s.effectiveUseWorkspaces === s.defaultUseWorkspaces
        ? undefined
        : {
            path: ['useWorkspaces'],
            from: s.defaultUseWorkspaces,
            to: s.effectiveUseWorkspaces,
          },
    reset: s => {
      s.resetUseWorkspaces()
    },
  },
]

// heads the subsystems above own outright: their row states the resolved value,
// so the session's override-map row for the same key would double-report it
// (and disagree with it whenever the two layers differ)
const SUBSYSTEM_HEADS = new Set(PREFERENCE_SUBSYSTEMS.map(p => p.head))

// every preference that currently differs from its default, so the confirmation
// dialog shows the full effect of a reset: the session override map plus each
// non-map subsystem above.
function collectPreferenceChanges(
  session: PreferencesDialogSession,
): TrackConfigChange[] {
  return [
    ...session
      .getPreferenceChanges()
      .filter(c => !SUBSYSTEM_HEADS.has(c.path[0]!)),
    ...PREFERENCE_SUBSYSTEMS.map(p => p.change(session)).filter(
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

// Revert a single change row (see `collectPreferenceChanges`) to its default:
// a non-map subsystem by matching `head`, everything else back through the
// session that produced the row. The override map's own path shapes are the
// session's business — it owns the composite-key layout a promoted
// display-type default is stored under, so it also owns undoing one.
function resetPreferenceChange(
  session: PreferencesDialogSession,
  change: TrackConfigChange,
) {
  const subsystem = PREFERENCE_SUBSYSTEMS.find(p => p.head === change.path[0])
  if (subsystem) {
    subsystem.reset(session)
  } else {
    session.resetPreferenceChange(change.path)
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
          <LabeledCheckbox
            checked={session.scrollZoom}
            label={`${SCROLL_ZOOM_LABEL}: ${SCROLL_ZOOM_HELP}`}
            onChange={checked => {
              session.setScrollZoom(checked)
            }}
          />
          <LabeledCheckbox
            checked={session.stickyViewHeaders}
            label="Keep view header visible"
            onChange={checked => {
              session.setStickyViewHeaders(checked)
            }}
          />
          <LabeledCheckbox
            checked={session.effectiveUseWorkspaces}
            label="Use workspaces (tabbed/tiled view layout)"
            onChange={checked => {
              session.setUseWorkspacesPreference(checked)
            }}
          />
          <LabeledCheckbox
            checked={session.numberGrouping}
            label="Show thousand separators in numbers, e.g. chr1:1,234,567 vs chr1:1234567 (reload app/refresh browser page to apply)"
            onChange={checked => {
              session.setPreferenceOverride('numberGrouping', checked)
            }}
          />
        </FormGroup>
        <Divider />
        <Typography variant="subtitle1" className={classes.panelHeading}>
          Display defaults
        </Typography>
        <DisplayDefaultsSection
          session={session}
          pluginManager={pluginManager}
        />
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
