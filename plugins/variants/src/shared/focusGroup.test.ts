import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { UNLABELED_GROUP } from './variantLegend.ts'

function display() {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorBy('population')
  display.setSources([
    { name: 'S0', population: 'AFR' },
    { name: 'S1', population: 'EUR' },
    { name: 'S2', population: 'AFR' },
    { name: 'S3' },
  ])
  return display
}

// Clicking a group's swatch in the legend narrows the rows to that group, the
// same write a tree-node click makes, so the sidebar's "Showing N rows" chip
// and "Clear subtree filter" are the way back.
test('focuses the rows of a colorBy group by its legend label', () => {
  const d = display()
  d.focusGroup('AFR')
  expect(d.sources.map(s => s.name)).toEqual(['S0', 'S2'])
  expect(d.subtreeFilter).toEqual(['S0', 'S2'])
})

test('the unlabeled group is the rows with no value', () => {
  const d = display()
  d.focusGroup(UNLABELED_GROUP)
  expect(d.sources.map(s => s.name)).toEqual(['S3'])
})

// The filter names sample-level rows, which is what `sourcesBase` is still
// spelling here: the haplotype expansion happens downstream of it, so a filter
// naming "S0 HP0" matched nothing and the click drew an empty display.
test('a legend focus in phased mode shows the group as haplotype rows', () => {
  const d = display()
  d.setPhasedMode('phased')
  d.setCellData({
    sampleInfo: {
      S0: { maxPloidy: 2 },
      S1: { maxPloidy: 2 },
      S2: { maxPloidy: 2 },
      S3: { maxPloidy: 2 },
    },
    rowNames: [],
  } as unknown as Parameters<typeof d.setCellData>[0])
  d.focusGroup('AFR')
  expect(d.subtreeFilter).toEqual(['S0', 'S2'])
  // The filter narrows `sampleFilter`, so the cells are refetched for the two
  // samples that are left and the haplotype rows come back with them
  expect(d.sources.map(s => s.name)).toEqual(['S0', 'S2'])
  d.setCellData({
    sampleInfo: { S0: { maxPloidy: 2 }, S2: { maxPloidy: 2 } },
    rowNames: [],
  } as unknown as Parameters<typeof d.setCellData>[0])
  expect(d.sources.map(s => s.name)).toEqual([
    'S0 HP0',
    'S0 HP1',
    'S2 HP0',
    'S2 HP1',
  ])
})

// A phased clustering run puts haplotype rows in `layout`, and then those ARE
// the names the filter matches — the tree-node path writes them too.
test('a legend focus after a phased clustering run names the haplotype rows', () => {
  const d = display()
  d.setPhasedMode('phased')
  d.setCellData({
    sampleInfo: {
      S0: { maxPloidy: 2 },
      S1: { maxPloidy: 2 },
      S2: { maxPloidy: 2 },
      S3: { maxPloidy: 2 },
    },
    rowNames: [],
  } as unknown as Parameters<typeof d.setCellData>[0])
  d.setLayout(
    ['S0', 'S1', 'S2', 'S3'].flatMap(sampleName => [
      { name: `${sampleName} HP0`, sampleName, HP: 0 },
      { name: `${sampleName} HP1`, sampleName, HP: 1 },
    ]),
  )
  d.focusGroup('AFR')
  expect(d.subtreeFilter).toEqual(['S0 HP0', 'S0 HP1', 'S2 HP0', 'S2 HP1'])
  expect(d.sources.map(s => s.name)).toEqual([
    'S0 HP0',
    'S0 HP1',
    'S2 HP0',
    'S2 HP1',
  ])
})
