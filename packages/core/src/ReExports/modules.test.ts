import reExportsList from './list.ts'
import libs from './modules.ts'

// list.ts is what plugin build tooling externalizes; modules.ts is what the
// host actually serves at runtime. They're maintained separately (list.ts must
// stay importable without pulling in React/MUI), so this is the only guard
// against drift: modules.ts threw on this at load until f742f6a96b, and the
// throw is gone.
test('re-export list and runtime module map are in sync', () => {
  expect(Object.keys(libs).sort()).toEqual([...reExportsList].sort())
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
  expect(typeof SvgIcon.createSvgIcon).toBe('function')
})

// `lazyMap`'s prefix builds *module map* keys -- one call yields
// '@mui/material/Button', '@mui/material/Dialog' and the rest as separate served
// modules. Passing one to a call that builds the *contents* of a single module
// makes that module's keys full subpaths, and then the documented
// `import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'`
// reads undefined -- while every in-tree consumer writes the same import and
// resolves it to the real module, so nothing in the repo can see it. Published
// ideogram 2.0.0 shipped against that shape for BaseCard and FeatureDetails.
//
// check-published-plugins.ts cannot catch this class: it diffs names against the
// previous release, and a module whose shape it could not read there
// (`shapeMismatchModules`) has nothing to diff. The invariant is local anyway --
// a served module's keys are export names, so none of them contains a slash.
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
