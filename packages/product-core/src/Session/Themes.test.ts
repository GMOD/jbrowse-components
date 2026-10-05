import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ThemeManagerSessionMixin, storedThemeArgs } from './Themes.ts'

const ConfigSchema = ConfigurationSchema('Root', {
  theme: { type: 'frozen', defaultValue: {} },
  extraThemes: { type: 'frozen', defaultValue: {} },
})

// the mixin reads its slots off `jbrowse` through `getConf`
const JBrowseModel = types.model('JBrowse', { configuration: ConfigSchema })

// jsdom ships no matchMedia, so each test stands up the OS half itself
class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media = '(prefers-color-scheme: dark)'
  onchange = null

  constructor(public matches: boolean) {
    super()
  }

  addListener() {}
  removeListener() {}

  setMatches(matches: boolean) {
    this.matches = matches
    this.dispatchEvent(new Event('change'))
  }
}

function installMatchMedia(matches: boolean) {
  const media = new FakeMediaQueryList(matches)
  window.matchMedia = () => media
  return media
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  localStorage.clear()
  delete document.documentElement.dataset.darkreaderScheme
})

// `afterAttach`, which subscribes to the OS, never fires on a root node
function makeSession(config: Record<string, unknown> = {}) {
  const pluginManager = new PluginManager([])
    .createPluggableElements()
    .configure()
  const Session = types.compose(
    types.model({ jbrowse: JBrowseModel }),
    ThemeManagerSessionMixin(pluginManager),
  )
  return types
    .model('Root', { session: Session })
    .create(
      { session: { jbrowse: { configuration: config } } },
      { pluginManager },
    ).session
}

// A dark OS is not a request for a dark genome browser, so following it is
// opt-in and a fresh session is light whatever the OS says.
test('a fresh session is light on a dark OS', () => {
  installMatchMedia(true)
  const session = makeSession()

  expect(session.themeName).toBe('default')
  expect(session.themeMode).toBe('light')
  expect(session.themeIsDark).toBe(false)
})

test('the system mode follows the OS, and keeps following it', () => {
  const media = installMatchMedia(true)
  const session = makeSession()
  session.setThemeMode('system')

  expect(session.effectiveThemeMode).toBe('dark')
  expect(session.themeIsDark).toBe(true)

  media.setMatches(false)
  expect(session.effectiveThemeMode).toBe('light')
  expect(session.themeIsDark).toBe(false)
  expect(session.themeMode).toBe('system')
})

// The whole point of the axis: a mode is not a palette, so moving along one
// leaves the other where it was.
test('a mode change keeps the palette, and a palette change keeps the mode', () => {
  installMatchMedia(false)
  const session = makeSession()
  session.setThemeName('minimal')
  session.setThemeMode('dark')

  expect(session.themeName).toBe('minimal')
  expect(session.themeIsDark).toBe(true)
  // minimal states one dark delta, a lighter primary than its light half
  expect(session.palette.primary.main).toBe('#616161')

  session.setThemeName('stock')
  expect(session.themeMode).toBe('dark')
  expect(session.palette.primary.main).toBe('#0D233F')
})

// `default` is the one palette that merges the config `theme` slot, and it now
// does so in both modes — which is what the old `darkStock` could not do.
test("a site's brand survives the dark half", () => {
  installMatchMedia(false)
  const session = makeSession({ theme: { palette: { primary: '#ff0000' } } })
  expect(session.palette.primary.main).toBe('#ff0000')

  session.setThemeMode('dark')
  expect(session.themeIsDark).toBe(true)
  expect(session.palette.primary.main).toBe('#ff0000')
  // and the rest of the palette went dark around it
  expect(session.palette.background.paper).toBe('#121212')
})

test('a held mode stays in system until the OS comes round to it', () => {
  const media = installMatchMedia(true)
  const session = makeSession()
  session.setThemeName('minimal')
  session.setThemeMode('system')

  session.setSystemThemeOverride('light')
  expect(session.themeMode).toBe('system')
  expect(session.themeIsDark).toBe(false)
  // the palette the reader picked is not collateral
  expect(session.themeName).toBe('minimal')

  media.setMatches(false)
  expect(session.systemThemeOverride).toBeUndefined()
  media.setMatches(true)
  expect(session.themeIsDark).toBe(true)
})

test('picking a mode in Preferences drops the held one', () => {
  installMatchMedia(true)
  const session = makeSession()
  session.setThemeMode('system')
  session.setSystemThemeOverride('light')

  session.setThemeMode('dark')
  session.setThemeMode('system')
  expect(session.themeIsDark).toBe(true)
})

test('a palette change keeps a held mode unless the palette pins its own', () => {
  installMatchMedia(true)
  const session = makeSession({
    extraThemes: { midnight: { name: 'M', palette: { mode: 'dark' } } },
  })
  session.setThemeMode('system')
  session.setSystemThemeOverride('light')

  session.setThemeName('minimal')
  expect(session.themeIsDark).toBe(false)

  session.setThemeName('midnight')
  session.setThemeName('default')
  expect(session.systemThemeOverride).toBeUndefined()
  expect(session.themeIsDark).toBe(true)
})

test('a held mode survives a reload only while the OS still disagrees', () => {
  installMatchMedia(true)
  const session = makeSession()
  session.setThemeMode('system')
  session.setSystemThemeOverride('light')

  expect(storedThemeArgs().mode).toBe('light')
  expect(makeSession().themeIsDark).toBe(false)

  installMatchMedia(false)
  expect(makeSession().systemThemeOverride).toBeUndefined()
})

// An explicit pick has to survive the OS flipping under it, which is the whole
// difference between picking dark and following a dark system.
test('an explicit mode stops following the OS', () => {
  const media = installMatchMedia(false)
  const session = makeSession()
  session.setThemeMode('light')

  media.setMatches(true)
  expect(session.effectiveThemeMode).toBe('light')
  expect(session.themeIsDark).toBe(false)
})

// `themeIsDark` reads the resolved palette, so a palette pinned to one mode
// answers for itself rather than for the session's mode.
test('an extra theme declaring dark mode reads as dark', () => {
  installMatchMedia(false)
  const session = makeSession({
    extraThemes: { midnight: { name: 'M', palette: { mode: 'dark' } } },
  })
  session.setThemeName('midnight')

  expect(session.themeMode).toBe('light')
  expect(session.themeIsDark).toBe(true)
})

test('without matchMedia the system mode is light', () => {
  const session = makeSession()
  session.setThemeMode('system')

  expect(session.effectiveThemeMode).toBe('light')
})

// The names from before the axis are what every stored selection, share link
// and `jbrowse-img --theme` carries, and they have to keep meaning their pair.
test.each([
  ['darkStock', 'stock', 'dark'],
  ['lightStock', 'stock', 'light'],
  ['darkMinimal', 'minimal', 'dark'],
  ['lightMinimal', 'minimal', 'light'],
] as const)('%s still means %s + %s', (legacy, palette, mode) => {
  installMatchMedia(false)
  const session = makeSession()
  session.setThemeName(legacy)

  expect(session.themeName).toBe(palette)
  expect(session.themeMode).toBe(mode)
})

test('a stored legacy name splits on the way in, and is stored split', () => {
  localStorage.setItem('themeName', 'darkMinimal')
  installMatchMedia(false)

  const session = makeSession()
  expect(session.themeName).toBe('minimal')
  expect(session.themeMode).toBe('dark')
  expect(localStorage.getItem('themeName')).toBe('minimal')
  expect(localStorage.getItem('themeMode')).toBe('dark')
})

// Desktop's start screen draws before any session exists, and opens in the
// palette and mode the last one stored
test.each([
  [{ themeName: 'minimal', themeMode: 'dark' }, false, 'minimal', 'dark'],
  [{ themeName: 'darkStock' }, false, 'stock', 'dark'],
  [{ themeMode: 'system' }, true, 'default', 'dark'],
  [{ themeMode: 'system' }, false, 'default', 'light'],
  [{}, true, 'default', 'light'],
])(
  'storedThemeArgs resolves %j (OS dark: %s)',
  (stored, osDark, themeName, mode) => {
    for (const [key, value] of Object.entries(stored)) {
      localStorage.setItem(key, value)
    }
    installMatchMedia(osDark)
    expect(storedThemeArgs()).toEqual({ themeName, mode })
  },
)

// A stored name whose plugin is absent has to come back rather than being
// coerced away.
test('a stored selection survives its theme being unregistered', () => {
  localStorage.setItem('themeName', 'someThemeFromAPlugin')
  installMatchMedia(false)

  expect(makeSession().themeName).toBe('default')
  expect(
    makeSession({ extraThemes: { someThemeFromAPlugin: { name: 'X' } } })
      .themeName,
  ).toBe('someThemeFromAPlugin')
})

// An SVG export is handed `getActiveThemeOptions` and nothing else, so if the
// mode does not ride along there, a dark session exports a light figure and
// nothing anywhere errors.
test('an export carries the mode the session is drawn in', () => {
  installMatchMedia(false)
  const session = makeSession({ theme: { palette: { primary: '#ff0000' } } })
  session.setThemeMode('dark')

  expect(session.getActiveThemeOptions().palette?.mode).toBe('dark')
  expect(session.getActiveThemeOptions().palette?.primary).toBe('#ff0000')
  expect(session.getActiveThemeOptions('minimal').palette?.mode).toBe('dark')

  session.setThemeMode('light')
  expect(session.getActiveThemeOptions().palette?.mode).toBe('light')
})

// A name the export dialog stored before the axis names a mode of its own, and
// it outranks the session's — the reader asked for that figure.
test('an export named by a retired theme keeps that mode', () => {
  installMatchMedia(false)
  const session = makeSession()

  const opts = session.getActiveThemeOptions('darkMinimal')
  expect(opts.palette?.mode).toBe('dark')
  expect(session.themeMode).toBe('light')
})

// Dark Reader's Dynamic mode darkens the page's CSS and leaves canvas pixels
// alone, so a light session draws a light canvas on a dark page. The session
// draws dark while the mark is there, keeps the stored mode, and goes back to
// it when Dark Reader is switched off.
test('a page Dark Reader has darkened draws dark until it is switched off', async () => {
  installMatchMedia(false)
  const session = makeSession()
  expect(session.themeIsDark).toBe(false)

  document.documentElement.dataset.darkreaderScheme = 'dark'
  await Promise.resolve()
  expect(session.effectiveThemeMode).toBe('dark')
  expect(session.themeIsDark).toBe(true)
  expect(session.themeMode).toBe('light')
  expect(session.themeOptions.mode).toBe('dark')

  delete document.documentElement.dataset.darkreaderScheme
  await Promise.resolve()
  expect(session.themeIsDark).toBe(false)
  expect(session.themeMode).toBe('light')
})

test('an export keeps the selected mode while Dark Reader darkens the page', () => {
  installMatchMedia(false)
  document.documentElement.dataset.darkreaderScheme = 'dark'
  const session = makeSession()

  expect(session.themeIsDark).toBe(true)
  expect(session.selectedThemeMode).toBe('light')
  expect(session.getActiveThemeOptions().palette?.mode).toBe('light')
})

test('Dark Reader already on at startup draws dark, and its light scheme does not', () => {
  installMatchMedia(false)
  document.documentElement.dataset.darkreaderScheme = 'dimmed'
  expect(makeSession().themeIsDark).toBe(false)

  document.documentElement.dataset.darkreaderScheme = 'dark'
  expect(makeSession().themeIsDark).toBe(true)
})
