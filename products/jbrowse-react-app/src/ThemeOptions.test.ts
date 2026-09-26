import { resolvePalette } from '@jbrowse/core/ui/palette'

import createViewState from './createViewState.ts'

import type { ThemeOptions } from '@mui/material'

jest.mock('./makeWorkerInstance', () => () => {})

const assemblies = [
  {
    name: 'volvox',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'volvox_refseq',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 10,
            seq: 'cattgttgcg',
          },
        ],
      },
    },
  },
]

const customTheme = { palette: { primary: { main: '#123456' } } }

function makeSession(theme?: unknown) {
  const state = createViewState({
    config: { assemblies, tracks: [], configuration: { theme } },
  })
  return state.session as unknown as {
    setThemeMode: (mode: 'light' | 'dark') => void
    setThemeName: (name: string) => void
    themeName: string
    themeOptions: { configTheme?: { palette?: Record<string, unknown> } }
    getActiveThemeOptions: (name?: string) => ThemeOptions | undefined
    palette: { mode: string; primary: { main: string } }
  }
}

// `setThemeMode` is what a host following its own dark-mode state calls. The
// host's configured colors have to survive it, in both directions — they used
// to be merged into by the write, back when a mode had nowhere to live but the
// config `theme` slot.
test('setThemeMode keeps the configured theme on an app session', () => {
  const session = makeSession(customTheme)

  session.setThemeMode('dark')
  expect(session.themeOptions.configTheme?.palette).toEqual({
    primary: { main: '#123456' },
  })
  expect(session.themeName).toBe('default')
  expect(session.palette.mode).toBe('dark')
  expect(session.palette.primary.main).toBe('#123456')

  session.setThemeMode('light')
  expect(session.palette.mode).toBe('light')
  expect(session.palette.primary.main).toBe('#123456')
})

// A host's dark-mode toggle and a user's theme pick move different things now,
// so neither undoes the other.
test('setThemeMode leaves the picked palette alone', () => {
  const session = makeSession()

  session.setThemeName('minimal')
  session.setThemeMode('dark')

  expect(session.themeName).toBe('minimal')
  expect(session.palette.mode).toBe('dark')
  expect(session.palette.primary.main).toBe('#616161')
})

// The SVG export's half of the same slot. Every view's `renderToSvg` asks the
// session for this and hands it to `wrapSvgExport` and to each display, both of
// which treat it as a `configTheme` — so it has to carry the whole of what the
// active theme is, and for `default` that includes the config slot the picker
// entry is named after ("Default (from config)").
//
// Asserted as a whole-palette equality rather than a spot check: the claim is
// that a figure is a picture of what is on screen, so the export must resolve
// the colors the screen resolved. Before this, a host configuring
// `primary.main` drew #123456 and exported the stock #0D233F.
test('getActiveThemeOptions resolves to the palette the screen is drawing', () => {
  const session = makeSession(customTheme)

  for (const mode of ['light', 'dark'] as const) {
    session.setThemeMode(mode)
    expect(
      resolvePalette({ configTheme: session.getActiveThemeOptions() }),
    ).toEqual(session.palette)
  }
})

// A name arriving from outside goes stale the same way the stored one does — an
// admin drops the `extraThemes` entry it names, or the export dialog's
// localStorage key (unscoped, so another JBrowse on this origin writes it)
// outlives the theme. Unresolved it fell past the `!== 'default'` branch as
// `undefined`, so the figure came out with no theme rather than the config's.
test('getActiveThemeOptions falls back for a name no theme answers to', () => {
  const session = makeSession(customTheme)

  expect(session.getActiveThemeOptions('themeThatWasRemoved')).toEqual(
    session.getActiveThemeOptions('default'),
  )
})
