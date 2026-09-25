import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SYSTEM_THEME, ThemeManagerSessionMixin } from './Themes.ts'

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

test('a fresh session follows the OS, and keeps following it', () => {
  const media = installMatchMedia(true)
  const session = makeSession()

  expect(session.selectedThemeName).toBe(SYSTEM_THEME)
  expect(session.themeName).toBe('darkStock')
  expect(session.themeIsDark).toBe(true)

  media.setMatches(false)
  expect(session.themeName).toBe('default')
  expect(session.themeIsDark).toBe(false)
  expect(session.selectedThemeName).toBe(SYSTEM_THEME)
})

// The light stop is `default` rather than `lightStock` because `default` is the
// one theme `resolvePalette` merges the config `theme` slot into, so a site's
// brand survives a user who follows their OS.
test("the light stop carries the config theme's colors", () => {
  installMatchMedia(false)
  const session = makeSession({ theme: { palette: { primary: '#ff0000' } } })

  expect(session.themeName).toBe('default')
  expect(session.palette.primary.main).toBe('#ff0000')
})

test('the control walks system, light, dark and back', () => {
  installMatchMedia(true)
  const session = makeSession()

  session.cycleThemeMode()
  expect(session.selectedThemeName).toBe('default')
  expect(session.themeIsDark).toBe(false)

  session.cycleThemeMode()
  expect(session.selectedThemeName).toBe('darkStock')
  expect(session.themeIsDark).toBe(true)

  session.cycleThemeMode()
  expect(session.selectedThemeName).toBe(SYSTEM_THEME)
})

// An explicit pick has to survive the OS flipping under it, which is the whole
// difference between picking a dark theme and following a dark system.
test('an explicit pick stops following the OS', () => {
  const media = installMatchMedia(false)
  const session = makeSession()
  session.setThemeName('lightStock')

  media.setMatches(true)
  expect(session.themeName).toBe('lightStock')
  expect(session.themeIsDark).toBe(false)
})

// A theme that is neither stop still has a mode, so the control moves to the
// other one rather than stalling.
test('the control leaves a theme that is neither stop by its mode', () => {
  installMatchMedia(false)
  const session = makeSession()
  session.setThemeName('darkMinimal')
  expect(session.themeIsDark).toBe(true)

  session.cycleThemeMode()
  expect(session.selectedThemeName).toBe(SYSTEM_THEME)
})

test('without matchMedia the system stop is light', () => {
  const session = makeSession()

  expect(session.selectedThemeName).toBe(SYSTEM_THEME)
  expect(session.themeName).toBe('default')
})

// Stored selections predate `system`, and a stored name whose plugin is absent
// still has to come back rather than being coerced away.
test('a stored selection wins over the system default', () => {
  localStorage.setItem('themeName', 'someThemeFromAPlugin')
  installMatchMedia(true)

  expect(makeSession().selectedThemeName).toBe('default')
  expect(
    makeSession({ extraThemes: { someThemeFromAPlugin: { name: 'X' } } })
      .selectedThemeName,
  ).toBe('someThemeFromAPlugin')
})
