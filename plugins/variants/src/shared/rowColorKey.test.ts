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

function rowColorKey(d: ReturnType<typeof display>) {
  return d.legendSpec.sections.find(s => s.id === 'rowColor')
}

test('keys the population colours beside the genotypes, the blank group unlisted', () => {
  const d = display()
  expect(d.legendSpec.sections.map(s => s.id)).toEqual([
    'genotypes',
    'rowColor',
  ])
  expect(rowColorKey(d)?.title).toBe('Population')
  expect(rowColorKey(d)?.items.map(i => i.value)).toEqual(['AFR', 'EUR'])
})

test('a legend click on the population key focuses it, on the genotype key nothing', () => {
  const d = display()
  d.focusLegendEntry('genotypes', 'ref')
  expect(d.rowFocus).toBeUndefined()
  d.focusLegendEntry('rowColor', 'AFR')
  expect(d.rowFocus).toEqual(['S0', 'S2'])
  expect(d.sources.map(s => s.name)).toEqual(['S0', 'S2'])
})

// The focus names the rows drawn, haplotypes here, and the fetch asks for their
// samples.
test('a legend focus in phased mode shows the group as haplotype rows', () => {
  const d = display()
  d.setPhasedMode('phased')
  d.setCellData({
    samplePloidy: { S0: 2, S1: 2, S2: 2, S3: 2 },
    rowNames: [],
  } as unknown as Parameters<typeof d.setCellData>[0])
  d.focusLegendEntry('rowColor', 'AFR')
  expect(d.rowFocus).toEqual(['S0 HP0', 'S0 HP1', 'S2 HP0', 'S2 HP1'])
  expect(d.sampleFilter).toEqual(['S0', 'S2'])
})
