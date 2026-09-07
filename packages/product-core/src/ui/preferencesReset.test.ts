import PluginManager from '@jbrowse/core/PluginManager'

import {
  collectPreferenceChanges,
  resetPreferenceChange,
} from './preferencesReset.ts'

import type { ResettablePreferencesSession } from './preferencesReset.ts'
import type { TrackConfigChange } from '@jbrowse/core/util'

const pluginManager = new PluginManager([])
  .createPluggableElements()
  .configure()

// the two halves of the preference map a session keeps, as the dialog sees
// them: scalar rows off `getPreferenceChanges`, promoted defaults off
// `getDisplayTypeDefaults`
function stubSession() {
  const scalars = new Map<string, TrackConfigChange>()
  const defaults = new Map<string, unknown>()
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
      defaults.clear()
    },
    clearPreferenceOverride: key => {
      scalars.delete(key)
    },
    getPreferenceChanges: () => [...scalars.values()],
    getDisplayTypeDefaults: () =>
      [...defaults].map(([key, value]) => {
        const [displayType, slot] = key.split('.')
        return { displayType: displayType!, slot: slot!, value }
      }),
    setDisplayTypeDefault: (displayType, slot, value) => {
      if (value === undefined) {
        defaults.delete(`${displayType}.${slot}`)
      } else {
        defaults.set(`${displayType}.${slot}`, value)
      }
    },
  }
  return { session, scalars, defaults }
}

test('the reset diff lists a promoted default beside the scalar rows', () => {
  const { session, scalars } = stubSession()
  scalars.set('scrollZoom', { path: ['scrollZoom'], from: false, to: true })
  session.setDisplayTypeDefault('LinearBasicDisplay', 'displayMode', 'compact')

  const changes = collectPreferenceChanges(session, pluginManager)

  expect(changes.map(c => c.path)).toEqual([
    ['scrollZoom'],
    ['displayTypeDefaults', 'LinearBasicDisplay', 'displayMode'],
  ])
  expect(changes[1]!.to).toBe('compact')
})

// The per-row revert hands a row straight back, so each shape the diff emits
// has to round-trip. A promoted default is the one that can silently no-op:
// its path is a readable address, not a key in the map.
test('a promoted default row resets through setDisplayTypeDefault', () => {
  const { session, defaults } = stubSession()
  session.setDisplayTypeDefault('LinearBasicDisplay', 'displayMode', 'compact')
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 3)
  const [row] = collectPreferenceChanges(session, pluginManager)

  resetPreferenceChange(session, row!)

  expect([...defaults.keys()]).toEqual([
    'LinearAlignmentsDisplay.featureHeight',
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
