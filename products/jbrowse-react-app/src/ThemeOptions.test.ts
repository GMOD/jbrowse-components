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

// `setThemeMode` is what a host following its own dark-mode state calls, and
// the app session is the harder of the two products to get right: it themes by
// *name*, and only the `default` theme merges the config `theme` slot (see
// `resolvePalette`). Expressing the mode as `setThemeName('darkStock')` would
// therefore drop the host's configured colors the first time their toggle
// fired, with nothing to say so.
test('setThemeMode keeps the configured theme on an app session', () => {
  const session = makeSession(customTheme)

  session.setThemeMode('dark')
  expect(session.themeOptions.configTheme?.palette).toEqual({
    primary: { main: '#123456' },
    mode: 'dark',
  })
  expect(session.themeName).toBe('default')
  expect(session.palette.mode).toBe('dark')
  expect(session.palette.primary.main).toBe('#123456')

  // and back, without accumulating anything
  session.setThemeMode('light')
  expect(session.palette.mode).toBe('light')
  expect(session.palette.primary.main).toBe('#123456')
})

// A host that follows its own dark mode and a user who picked a theme from
// JBrowse's menu are the same one slot seen twice, so the later write wins in
// both directions.
test('setThemeMode returns to the default theme from a named one', () => {
  const session = makeSession()

  session.setThemeName('darkMinimal')
  expect(session.themeName).toBe('darkMinimal')

  session.setThemeMode('dark')
  expect(session.themeName).toBe('default')
  expect(session.palette.mode).toBe('dark')
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
