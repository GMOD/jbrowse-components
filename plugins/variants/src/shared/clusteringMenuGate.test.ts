import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Clustering reorders rows, so it needs at least two rows to reorder. All three
// clustering displays state that gate on the menu row rather than inside the
// dialog — otherwise "Run clustering" is a button that opens, spins and reports
// there was nothing to do.
//
// Driven off a real display through the regular display's harness, because the
// row is built by the shared `variantTrackMenuItems` both multi-sample variant
// displays take, and the gate reads `sourcesWithoutLayout`, a getter over
// `sourcesVolatile` that a stub would have to restate.
function clusterRow(sources?: { name: string }[]) {
  const { display } = createTestEnvironment().createDisplay()
  if (sources) {
    display.setSources(sources)
  }
  const clustering = display
    .trackMenuItems()
    .find(item => 'label' in item && item.label === 'Clustering')
  const subMenu: MenuItem[] =
    clustering && 'subMenu' in clustering ? clustering.subMenu : []
  const row = subMenu.find(
    item => 'label' in item && item.label === 'Cluster rows by genotype...',
  )
  if (!row) {
    throw new Error('no "Cluster rows by genotype..." row')
  }
  return row as MenuItem & { disabled?: boolean; disabledHelpText?: string }
}

test('offers clustering once there are two samples to cluster', () => {
  expect(clusterRow([{ name: 'HG001' }, { name: 'HG002' }]).disabled).toBe(
    false,
  )
})

test('refuses to cluster a single sample, and says which is missing', () => {
  const row = clusterRow([{ name: 'HG001' }])

  expect(row.disabled).toBe(true)
  expect(row.disabledHelpText).toBe('Needs at least two samples to cluster')
})

// Before the adapter reports its samples the count is not "one", it is unknown
// — `sourcesWithoutLayout` is undefined — and a row that blamed the cohort
// would be wrong about why it is off.
test('says it is still loading before the samples arrive', () => {
  const row = clusterRow()

  expect(row.disabled).toBe(true)
  expect(row.disabledHelpText).toBe('Loading samples...')
})
