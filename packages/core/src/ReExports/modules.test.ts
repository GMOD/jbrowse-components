import reExportsList from './list.ts'
import libs from './modules.ts'

// list.ts is what plugin build tooling externalizes; modules.ts is what the
// host actually serves at runtime. They're maintained separately (list.ts must
// stay importable without pulling in React/MUI), so this guards against drift —
// the same invariant modules.ts throws on at load, run here so CI catches it.
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
