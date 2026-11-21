import { labelPreferenceChange } from './preferenceLabels.ts'

import type { TrackConfigChange } from '@jbrowse/core/util'

export interface ResettablePreferencesSession {
  themeName?: string
  setThemeName: (arg: string) => void
  themeMode: 'light' | 'dark' | 'system'
  setThemeMode: (arg: 'light' | 'dark' | 'system') => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  clearPreferenceOverrides: () => void
  clearPreferenceOverride: (key: string) => void
  getPreferenceChanges: () => TrackConfigChange[]
}

/**
 * A preference held outside the session override map, with its own default
 * and reset; the map's row for the same key is dropped in favour of it, which
 * reports the resolved value. A preferences panel lists its own
 * (`PreferencesPanelDescriptor.resettable`).
 */
export interface ResettablePreference {
  head: string
  change: (
    session: ResettablePreferencesSession,
  ) => TrackConfigChange | undefined
  reset: (session: ResettablePreferencesSession) => void
}

const NON_MAP_PREFERENCES: ResettablePreference[] = [
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
    head: 'themeMode',
    change: s =>
      s.themeMode === 'light'
        ? undefined
        : { path: ['themeMode'], from: 'light', to: s.themeMode },
    reset: s => {
      s.setThemeMode('light')
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
]

// Everything "Reset to defaults" reverts, as rows: the scalar overrides in the
// preference map, and the preferences held outside it.
export function collectPreferenceChanges(
  session: ResettablePreferencesSession,
  panelPreferences: readonly ResettablePreference[] = [],
) {
  const nonMap = [...NON_MAP_PREFERENCES, ...panelPreferences]
  const heads = new Set(nonMap.map(p => p.head))
  return [
    ...session.getPreferenceChanges().filter(c => !heads.has(c.path[0]!)),
    ...nonMap.map(p => p.change(session)).filter(c => c !== undefined),
  ].map(labelPreferenceChange)
}

export function resetAllPreferences(
  session: ResettablePreferencesSession,
  panelPreferences: readonly ResettablePreference[] = [],
) {
  session.clearPreferenceOverrides()
  for (const p of [...NON_MAP_PREFERENCES, ...panelPreferences]) {
    p.reset(session)
  }
}

export function resetPreferenceChange(
  session: ResettablePreferencesSession,
  change: TrackConfigChange,
  panelPreferences: readonly ResettablePreference[] = [],
) {
  const [head] = change.path
  const pref = [...NON_MAP_PREFERENCES, ...panelPreferences].find(
    p => p.head === head,
  )
  if (pref) {
    pref.reset(session)
  } else if (head) {
    session.clearPreferenceOverride(head)
  }
}
