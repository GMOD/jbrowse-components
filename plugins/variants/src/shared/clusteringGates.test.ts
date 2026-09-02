import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The two questions that decide whether clustering may run, and the menu row
// that reports the answer.
//
// `hasClusterableRows` — is there more than one row to put in an order.
// `autoClusterReady` — that AND `clusteringReady` (the fetched inputs are
// here), which is what the declarative `runClustering: true` autorun fires on.
// They are separate getters rather than one condition at the autorun precisely
// so the table below can drive each independently; the run itself is pinned in
// LinearMultiSampleVariantDisplay/clusterAutorunGate.test.ts.
//
// Driven off a real display through the regular display's harness, because the
// row is built by the shared `variantTrackMenuItems` both multi-sample variant
// displays take, and the gates read `sources`, a getter over `sourcesVolatile`,
// `layout` and `subtreeFilter` that a stub would have to restate.
function display(sources?: { name: string }[]) {
  const { display } = createTestEnvironment().createDisplay()
  if (sources) {
    display.setSources(sources)
  }
  return display
}

const one = [{ name: 'HG001' }]
const two = [{ name: 'HG001' }, { name: 'HG002' }]

test('two rows is the whole of hasClusterableRows', () => {
  expect(display().hasClusterableRows).toBe(false)
  expect(display([]).hasClusterableRows).toBe(false)
  expect(display(one).hasClusterableRows).toBe(false)
  expect(display(two).hasClusterableRows).toBe(true)
})

// `clusteringReady` is "have the fetched inputs landed", and in allele-count
// mode the sample list alone satisfies it — so these rows also fix which half
// of the conjunction each case is failing on.
test('the auto path needs the inputs AND the rows', () => {
  expect(display().clusteringReady).toBe(false)
  expect(display().autoClusterReady).toBe(false)

  // inputs, no rows
  expect(display(one).clusteringReady).toBe(true)
  expect(display(one).autoClusterReady).toBe(false)

  // both
  expect(display(two).clusteringReady).toBe(true)
  expect(display(two).autoClusterReady).toBe(true)
})

// Phased clustering clusters haplotypes, which needs the per-sample ploidy that
// rides with cellData — so rows alone are not enough there, and the conjunction
// has to keep failing on the other half.
// The run clusters the rows on screen, so a clade focused down to one row has
// nothing to order — and `clusterMatrix` refuses below two rows, so an ungated
// run is an error dialog rather than a no-op.
test('a subtree filter down to one row closes the gate', () => {
  const d = display(two)
  expect(d.hasClusterableRows).toBe(true)

  d.setSubtreeFilter(['HG001'])
  expect(d.hasClusterableRows).toBe(false)
  expect(d.autoClusterReady).toBe(false)

  d.setSubtreeFilter(undefined)
  expect(d.hasClusterableRows).toBe(true)
})

test('phased mode holds the auto path back until the ploidy lands', () => {
  const d = display(two)
  d.setPhasedMode('phased')

  expect(d.hasClusterableRows).toBe(true)
  expect(d.clusteringReady).toBe(false)
  expect(d.autoClusterReady).toBe(false)
})

// The menu row those two getters surface, which is the only place a user is
// told any of this.
function clusterRow(sources?: { name: string }[]) {
  const clustering = display(sources)
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
  expect(row.disabledHelpText).toBe('Needs at least two rows to cluster')
})

// Before the adapter reports its samples the count is not "one", it is unknown
// — `sourcesVolatile` is undefined — and a row that blamed the cohort would be
// wrong about why it is off.
test('says it is still loading before the samples arrive', () => {
  const row = clusterRow()

  expect(row.disabled).toBe(true)
  expect(row.disabledHelpText).toBe('Loading samples...')
})
