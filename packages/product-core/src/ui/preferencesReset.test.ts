import {
  collectPreferenceChanges,
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
    stickyViewHeaders: true,
    setStickyViewHeaders: () => {},
    effectiveUseWorkspaces: false,
    defaultUseWorkspaces: false,
    resetUseWorkspaces: () => {},
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
  session.setThemeName('lightStock')
  session.themeName = 'lightStock'

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
