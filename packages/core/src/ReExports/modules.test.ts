import reExportsList from './list.ts'
import libs from './modules.ts'

// list.ts is what plugin build tooling externalizes and what every product
// serves in union; modules.ts is the part of it @jbrowse/core serves on its
// own. Both are generated from the same run, so this pins the assembly in
// modules.ts rather than the derivation.
test('core serves a subset of the list, and nothing outside it', () => {
  const list = new Set(reExportsList)
  expect(Object.keys(libs).filter(key => !list.has(key))).toEqual([])
  expect(
    reExportsList.filter(
      key =>
        (key.startsWith('@jbrowse/core/') || !key.startsWith('@jbrowse/')) &&
        !(key in libs),
    ),
  ).toEqual([])
})

// GMOD/jbrowse-components#5606: an external plugin that bundles @mui/icons-material
// reads the `createSvgIcon` named export from @mui/material/SvgIcon. Exposing only
// the component drops it (icons crash); exposing a plain namespace object breaks
// the default import ("Element type is invalid") because rollup-plugin-external-
// globals substitutes the value itself. The exposed value must be usable as a
// component AND carry createSvgIcon.
test('@mui/material/SvgIcon exposes createSvgIcon to external plugins (#5606)', () => {
  const SvgIcon = libs['@mui/material/SvgIcon']
  // usable as a React element type: a function, or a forwardRef/memo object
  const isValidElementType =
    typeof SvgIcon === 'function' ||
    (typeof SvgIcon === 'object' && SvgIcon !== null && '$$typeof' in SvgIcon)
  expect(isValidElementType).toBe(true)
  // the named export icons-material's createSvgIcon call needs
  expect(typeof (SvgIcon as { createSvgIcon?: unknown }).createSvgIcon).toBe(
    'function',
  )
})

// A served module's keys are export names, so none of them contains a slash:
// published ideogram 2.0.0 shipped against a `BaseFeatureDetail` whose keys
// were full subpaths, reading `undefined` for `BaseCard`.
test('a served @jbrowse/core module is keyed by export name, not by subpath', () => {
  const offenders = Object.entries(libs)
    .filter(([name]) => name.startsWith('@jbrowse/core/'))
    .filter(([, mod]) => mod !== null && typeof mod === 'object')
    .flatMap(([name, mod]) =>
      Object.keys(mod as object)
        .filter(key => key.includes('/'))
        .map(key => `${name} -> ${key}`),
    )
  expect(offenders).toEqual([])
})

// A runtime plugin's default import reads the served value itself when the
// module has only a default export, and `.default` off an `__esModule`
// namespace when it has named exports beside one — the two shapes a bundler's
// interop distinguishes. The generator picks per module; this pins the pick
// for the two published plugins read most.
test('a default-only module is served bare; a mixed one as an __esModule namespace', () => {
  expect(typeof libs['@jbrowse/core/Plugin']).toBe('function')
  const pluginManager = libs['@jbrowse/core/PluginManager'] as Record<
    string,
    unknown
  >
  expect(pluginManager.__esModule).toBe(true)
  expect(typeof pluginManager.default).toBe('function')
})

// Published apollo reads `BaseTooltip` off the `@jbrowse/core/ui` namespace;
// the barrel serves it lazily so @floating-ui stays off the startup path.
test('the ui namespace serves BaseTooltip', () => {
  expect(
    typeof (libs['@jbrowse/core/ui'] as Record<string, unknown>).BaseTooltip,
  ).toBe('function')
})

// A plugin that bundles core's Dialog (any deep import reaching ui/index.js
// does) renders ThemeProvider from the host's @mui/material; absent, that is
// React error #130 when the dialog opens.
test('@mui/material serves ThemeProvider', () => {
  expect(
    (libs['@mui/material'] as Record<string, unknown>).ThemeProvider,
  ).toBeDefined()
})
