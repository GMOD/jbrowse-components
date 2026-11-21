import {
  collectPreferenceChanges,
  resetAllPreferences,
  resetPreferenceChange,
} from './preferencesReset.ts'

import type { ResettablePreferencesSession } from './preferencesReset.ts'
import type { TrackConfigChange } from '@jbrowse/core/util'

// the scalar half of the preference map, as the dialog sees it
function stubSession() {
  const scalars = new Map<string, TrackConfigChange>()
  const session: ResettablePreferencesSession = {
    themeName: 'default',
    setThemeName: () => {},
    themeMode: 'light' as const,
    setThemeMode: () => {},
    stickyViewHeaders: true,
    setStickyViewHeaders: () => {},
    clearPreferenceOverrides: () => {
      scalars.clear()
    },
    clearPreferenceOverride: key => {
      scalars.delete(key)
    },
    getPreferenceChanges: () => [...scalars.values()],
  }
  return { session, scalars }
}

test('the reset diff lists the scalar rows and the off-map preferences', () => {
  const { session, scalars } = stubSession()
  scalars.set('scrollZoom', { path: ['scrollZoom'], from: false, to: true })
  session.setThemeName('minimal')
  session.themeName = 'minimal'

  expect(collectPreferenceChanges(session).map(c => c.path)).toEqual([
    ['scrollZoom'],
    ['theme'],
  ])
})

test('a scalar row resets by its own key', () => {
  const { session, scalars } = stubSession()
  scalars.set('scrollZoom', { path: ['scrollZoom'], from: false, to: true })

  resetPreferenceChange(session, {
    path: ['scrollZoom'],
    from: false,
    to: true,
  })

  expect(scalars.size).toBe(0)
})

test("a panel's own preferences list and reset with the rest", () => {
  const { session } = stubSession()
  let stored = true
  const panel = [
    {
      head: 'lgv-showCenterLine',
      change: () =>
        stored
          ? { path: ['lgv-showCenterLine'], from: false, to: true }
          : undefined,
      reset: () => {
        stored = false
      },
    },
  ]

  expect(collectPreferenceChanges(session, panel).map(c => c.path)).toEqual([
    ['lgv-showCenterLine'],
  ])
  resetPreferenceChange(
    session,
    { path: ['lgv-showCenterLine'], from: false, to: true },
    panel,
  )
  expect(stored).toBe(false)
  stored = true
  resetAllPreferences(session, panel)
  expect(stored).toBe(false)
})
