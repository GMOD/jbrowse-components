import createViewState from './createViewState.ts'

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
