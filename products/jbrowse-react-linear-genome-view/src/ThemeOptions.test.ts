import { resolvePalette } from '@jbrowse/core/ui/palette'

import { createViewState } from './index.ts'

import type { ThemeOptions } from '@mui/material'

jest.mock('./makeWorkerInstance', () => () => {})

// Regression guard: the embedded session must expose `themeOptions`
// (SerializableThemeArgs), because the canvas LinearBasicDisplay reads
// `getSession(self).themeOptions` in its rpcProps to ship theme to the worker.
// When this getter was missing, worker-baked colors (CDS frames, stroke
// fallback, floating labels) silently fell back to the default theme and
// ignored the config `theme` slot.

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
      ],
    },
  },
}

const customTheme = { palette: { primary: { main: '#123456' } } }

test('session.themeOptions carries the config theme slot (feeds canvas worker rpcProps)', () => {
  const state = createViewState({
    assembly,
    tracks: [],
    configuration: { theme: customTheme },
  })
  const session = state.session as unknown as {
    themeOptions: { configTheme?: unknown; themeName?: string }
  }

  expect(session.themeOptions.configTheme).toEqual(customTheme)
  expect(session.themeOptions.themeName).toBe('default')
})

// `setThemeMode` is what a host follows its own dark mode with, and it writes
// the *config* slot rather than a React-side palette on purpose: that slot is
// also what `themeOptions` above ships to the worker, so the labels baked into
// a rendered image change mode along with everything React draws.
//
// `theme` is a frozen slot, so the write has to merge — at both levels, since
// `resolvePalette` spreads `configTheme.palette` over the preset shallowly and
// `mode` and `primary` are therefore siblings. A bare
// `setConf(session, 'theme', { palette: { mode } })` discards the host's
// configured colors the first time their toggle fires, with nothing to say so.
test('setThemeMode keeps the rest of the configured theme', () => {
  const state = createViewState({
    assembly,
    tracks: [],
    configuration: { theme: customTheme },
  })
  const session = state.session as unknown as {
    setThemeMode: (mode: 'light' | 'dark') => void
    themeOptions: { configTheme?: { palette?: Record<string, unknown> } }
    palette: { mode: string; primary: { main: string } }
  }

  session.setThemeMode('dark')
  expect(session.themeOptions.configTheme?.palette).toEqual({
    primary: { main: '#123456' },
    mode: 'dark',
  })
  expect(session.palette.mode).toBe('dark')
  expect(session.palette.primary.main).toBe('#123456')

  // and back, without accumulating anything
  session.setThemeMode('light')
  expect(session.palette.mode).toBe('light')
  expect(session.palette.primary.main).toBe('#123456')
})

// The SVG export's half of the same slot, and the one an embedded session used
// not to have at all.
//
// `renderToSvg` asks the session for `getActiveThemeOptions` optionally, so a
// session without it exports with `undefined` — which is not "no theme" but the
// default *light* palette, at every step of the path: the ruler and track
// labels, the colors each display bakes into its own bodies, and the background
// rect. A host in dark mode got a light figure and no error.
//
// Asserted as a whole-palette equality rather than a spot check on `mode`,
// because the claim is not "dark exports dark" but "the figure is a picture of
// what is on screen": whatever the host configured, the export resolves the same
// colors the screen resolved.
test('getActiveThemeOptions resolves to the palette the screen is drawing', () => {
  const state = createViewState({
    assembly,
    tracks: [],
    configuration: { theme: customTheme },
  })
  const session = state.session as unknown as {
    setThemeMode: (mode: 'light' | 'dark') => void
    getActiveThemeOptions: (name?: string) => ThemeOptions | undefined
    palette: Record<string, unknown>
  }

  for (const mode of ['light', 'dark'] as const) {
    session.setThemeMode(mode)
    // exactly what each display's renderSvg does with the value it is handed
    const exported = resolvePalette({
      configTheme: session.getActiveThemeOptions(),
    })
    expect(exported).toEqual(session.palette)
    expect(exported.mode).toBe(mode)
    expect(exported.primary.main).toBe('#123456')
  }
})
