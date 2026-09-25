import { setConf } from '@jbrowse/core/configuration'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

function display() {
  const { display } = createTestEnvironment().createDisplay()
  display.setRowColorField('population')
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
test('focuses the rows of a colorBy group by its value', () => {
  const d = display()
  d.focusGroup('AFR')
  expect(d.sources.map(s => s.name)).toEqual(['S0', 'S2'])
  expect(d.rowFocus).toEqual(['S0', 'S2'])
})

test('the unlabeled group is the rows with no value', () => {
  const d = display()
  d.focusGroup('')
  expect(d.sources.map(s => s.name)).toEqual(['S3'])
})

// The chrome hands a click the scale id and the row's value, and only the group
// scale's rows act: a genotype swatch names a color, not a set of rows.
test('a legend click on the group scale focuses it, on the genotype scale nothing', () => {
  const d = display()
  const group = d.legendSpec.sections.find(s => s.id === 'group')!
  expect(group.items.find(i => i.label === NO_VALUE_LABEL)!.value).toBe('')
  d.focusLegendEntry('genotypes', 'ref')
  expect(d.rowFocus).toBeUndefined()
  d.focusLegendEntry('group', 'AFR')
  expect(d.rowFocus).toEqual(['S0', 'S2'])
})

// The focus names the rows drawn, haplotypes here, and the fetch asks for their
// samples.
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
  expect(d.rowFocus).toEqual(['S0 HP0', 'S0 HP1', 'S2 HP0', 'S2 HP1'])
  expect(d.sampleFilter).toEqual(['S0', 'S2'])
  // The focus narrows `sampleFilter`, so the cells are refetched for the two
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

// After a phased clustering run the order names haplotypes too, and the
// tree-node path writes the same names.
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
  d.setRowOrder(
    ['S0', 'S1', 'S2', 'S3'].flatMap(sampleName => [
      { name: `${sampleName} HP0`, sampleName, HP: 0 },
      { name: `${sampleName} HP1`, sampleName, HP: 1 },
    ]),
  )
  d.focusGroup('AFR')
  expect(d.rowFocus).toEqual(['S0 HP0', 'S0 HP1', 'S2 HP0', 'S2 HP1'])
  expect(d.sources.map(s => s.name)).toEqual([
    'S0 HP0',
    'S0 HP1',
    'S2 HP0',
    'S2 HP1',
  ])
})

function groupKey(d: ReturnType<typeof display>) {
  return d.legendSpec.sections
    .find(s => s.id === 'group')!
    .items.map(i => i.value)
}

// The bands and the key name one attribute, so they read in one order: the
// facet's domain first, whatever the counts are.
test('the group key follows the bands when the facet reads the same field', () => {
  const d = display()
  setConf(d, 'facet', { field: 'population', domain: ['EUR', 'AFR'] })
  expect(groupKey(d)).toEqual(['EUR', 'AFR', ''])
})

// Unbanded, the key lists values as the palette dealt them, most common across
// the callset first, so a focus narrows the key without re-ranking it.
test('the group key follows the palette deal, and a focus does not re-rank it', () => {
  const d = display()
  d.setSources([
    { name: 'S0', population: 'EUR' },
    { name: 'S1', population: 'AFR' },
    { name: 'S2', population: 'EUR' },
    { name: 'S3', population: 'AFR' },
    { name: 'S4', population: 'EUR' },
    { name: 'S5' },
  ])
  expect(groupKey(d)).toEqual(['EUR', 'AFR', ''])
  d.setRowFocus(['S1', 'S3', 'S4', 'S5'])
  expect(groupKey(d)).toEqual(['EUR', 'AFR', ''])
})
