import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { ThemeManagerSessionMixin } from './Themes.ts'

const ConfigSchema = ConfigurationSchema('Root', {
  theme: { type: 'frozen', defaultValue: {} },
  extraThemes: { type: 'frozen', defaultValue: {} },
})

// `jbrowse` on a real session is the root model's config holder, and the mixin
// reads its slots through `getConf`
const JBrowseModel = types.model('JBrowse', { configuration: ConfigSchema })

// jsdom ships no matchMedia, so the OS half is stood up per test and torn down
// after — an absent query is itself a case, and it is the one every other suite
// in the repo runs under.
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
})

// The session hangs off a parent, as it does in every product: `afterAttach`,
// where the OS subscription is installed, does not fire for a root node.
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

test('leaving the following lands on the mode the OS was not asking for', () => {
  const media = installMatchMedia(true)
  const session = makeSession()
  session.setThemeName('minimal')
  session.setThemeMode('system')

  session.stopFollowingSystemTheme()
  expect(session.themeMode).toBe('light')
  // the palette the reader picked is not collateral
  expect(session.themeName).toBe('minimal')

  media.setMatches(false)
  session.setThemeMode('system')
  session.stopFollowingSystemTheme()
  expect(session.themeMode).toBe('dark')
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
