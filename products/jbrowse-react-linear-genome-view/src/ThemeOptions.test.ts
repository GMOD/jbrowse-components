import { createViewState } from './index.ts'

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
