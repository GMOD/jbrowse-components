import {
  displayDefaultChanges,
  resetDisplayDefault,
} from './displayDefaultChanges.ts'

import type { DisplayDefaultsSession } from './displayDefaultChanges.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackConfigChange } from '@jbrowse/core/util'

export interface ResettablePreferencesSession extends DisplayDefaultsSession {
  themeName?: string
  setThemeName: (arg: string) => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  effectiveUseWorkspaces: boolean
  defaultUseWorkspaces: boolean
  resetUseWorkspaces: () => void
  clearPreferenceOverrides: () => void
  clearPreferenceOverride: (key: string) => void
  getPreferenceChanges: () => TrackConfigChange[]
}

// preferences held outside the session override map, each with its own default
// and reset; the map's row for the same key is dropped in favour of these,
// which report the resolved value
interface NonMapPreference {
  head: string
  change: (
    session: ResettablePreferencesSession,
  ) => TrackConfigChange | undefined
  reset: (session: ResettablePreferencesSession) => void
}

const NON_MAP_PREFERENCES: NonMapPreference[] = [
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

const NON_MAP_HEADS = new Set(NON_MAP_PREFERENCES.map(p => p.head))

// Everything "Reset to defaults" reverts, as rows: the scalar overrides in the
// preference map, the promoted display-type defaults (same map, listed through
// the builder the Display defaults section uses so both surfaces read alike),
// and the preferences held outside the map.
export function collectPreferenceChanges(
  session: ResettablePreferencesSession,
  pluginManager: PluginManager,
) {
  return [
    ...session
      .getPreferenceChanges()
      .filter(c => !NON_MAP_HEADS.has(c.path[0]!)),
    ...displayDefaultChanges(session, pluginManager),
    ...NON_MAP_PREFERENCES.map(p => p.change(session)).filter(
      c => c !== undefined,
    ),
  ]
}

export function resetAllPreferences(session: ResettablePreferencesSession) {
  session.clearPreferenceOverrides()
  for (const p of NON_MAP_PREFERENCES) {
    p.reset(session)
  }
}

export function resetPreferenceChange(
  session: ResettablePreferencesSession,
  change: TrackConfigChange,
) {
  const [head] = change.path
  const pref = NON_MAP_PREFERENCES.find(p => p.head === head)
  if (pref) {
    pref.reset(session)
  } else if (!resetDisplayDefault(session, change) && head) {
    session.clearPreferenceOverride(head)
  }
}
