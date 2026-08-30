import PluginManager from '@jbrowse/core/PluginManager'
import { types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory } from './model.ts'

// The shape three of the demo builders author (`scripts/build_lct_ld.sh`,
// `build_tcga_cohort_cnv.sh`, `build_tcga_cohort_mutations.sh`): a spec's flat
// launch keys written straight onto a `defaultSession` view, where MST has no
// property for them.
const FLAT = {
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc: 'chr2:134,000,000-137,150,000',
}

const NESTED = {
  type: 'LinearGenomeView',
  init: { assembly: 'hg38', loc: 'chr2:134,000,000-137,150,000' },
}

const notify = jest.fn()

function open(snap: unknown) {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return types
    .model({
      rpcManager: types.frozen(),
      configuration: types.frozen(),
      view: stateModelFactory(pm),
    })
    .actions(() => ({ notify }))
    .create({ rpcManager: {}, configuration: {}, view: snap } as any).view
}

let warn: jest.SpyInstance

beforeEach(() => {
  notify.mockClear()
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

test('a flat launch key on a view snapshot is named', () => {
  open(FLAT)
  expect(warnings()).toEqual([
    'LinearGenomeView ignored unknown key(s): assembly, loc',
  ])
  expect(notify).toHaveBeenCalledWith(
    'LinearGenomeView ignored unknown key(s): assembly, loc',
    'warning',
  )
})

test('the same keys inside init say nothing', () => {
  open(NESTED)
  expect(warnings()).toEqual([])
  expect(notify).not.toHaveBeenCalled()
})

test('a legacy viewport snapshot says nothing', () => {
  // bpPerPx/offsetPx are no longer declared properties; the model's own
  // preProcessSnapshot converts them, and the capture runs after it
  open({ type: 'LinearGenomeView', bpPerPx: 10, offsetPx: 1000 })
  expect(warnings()).toEqual([])
})
