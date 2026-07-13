import { getTooltipRows } from './getTooltipRows.ts'

test('variant fields render first in fixed order with friendly labels', () => {
  const rows = getTooltipRows({
    name: 'HG001',
    genotype: '0|1',
    alleles: 'ref(A)|T',
    featureName: 'rs123',
    length: '1 bp',
    description: 'SNV',
  })
  expect(rows).toEqual([
    { key: 'featureName', label: 'Name', value: 'rs123' },
    { key: 'genotype', label: 'Genotype', value: '0|1' },
    { key: 'alleles', label: 'Alleles', value: 'ref(A)|T' },
    { key: 'length', label: 'Length', value: '1 bp' },
    { key: 'description', label: 'Description', value: 'SNV' },
  ])
})

test('metadata attributes follow, capitalized, internal keys hidden', () => {
  const rows = getTooltipRows({
    name: 'HG001',
    sampleName: 'HG001',
    color: 'red',
    genotype: '0|1',
    population: 'EUR',
  })
  expect(rows).toEqual([
    { key: 'genotype', label: 'Genotype', value: '0|1' },
    { key: 'population', label: 'Population', value: 'EUR' },
  ])
})

test('empty and undefined values are skipped', () => {
  const rows = getTooltipRows({
    genotype: '0|1',
    description: '',
    length: undefined,
    population: 'EUR',
  })
  expect(rows.map(r => r.key)).toEqual(['genotype', 'population'])
})
