import PluginManager from '@jbrowse/core/PluginManager'

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

function model() {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  return stateModelFactory(pm)
}

test('a flat launch key on a view snapshot is reported', () => {
  model().create(FLAT)
  const report = takeContractReports().join('\n')
  expect(report).toContain('[jbrowse view contract]')
  expect(report).toContain('LinearGenomeView')
  expect(report).toContain('assembly')
  expect(report).toContain('loc')
  expect(report).toContain('init')
})

test('the same keys inside init say nothing', () => {
  model().create(NESTED)
  expect(takeContractReports()).toEqual([])
})

test('a legacy viewport snapshot says nothing', () => {
  // bpPerPx/offsetPx are no longer declared properties; the model's own
  // preProcessSnapshot converts them, and the check runs after it
  model().create({
    type: 'LinearGenomeView',
    bpPerPx: 10,
    offsetPx: 1000,
  } as any)
  expect(takeContractReports()).toEqual([])
})
