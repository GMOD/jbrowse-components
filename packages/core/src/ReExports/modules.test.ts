import reExportsList from './list.ts'
import libs from './modules.ts'

// list.ts is what plugin build tooling externalizes; modules.ts is what the
// host actually serves at runtime. They're maintained separately (list.ts must
// stay importable without pulling in React/MUI), so this guards against drift —
// the same invariant modules.ts throws on at load, run here so CI catches it.
test('re-export list and runtime module map are in sync', () => {
  expect(Object.keys(libs).sort()).toEqual([...reExportsList].sort())
})
