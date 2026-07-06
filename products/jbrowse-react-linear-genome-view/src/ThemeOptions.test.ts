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
