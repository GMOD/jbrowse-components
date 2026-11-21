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

test('the row sample metadata follows, capitalized, internal keys hidden', () => {
  const rows = getTooltipRows({
    name: 'HG001',
    genotype: '0|1',
    sample: {
      name: 'HG001',
      sampleName: 'HG001',
      color: 'red',
      population: 'EUR',
    },
  })
  expect(rows).toEqual([
    { key: 'genotype', label: 'Genotype', value: '0|1' },
    { key: 'sample.population', label: 'Population', value: 'EUR' },
  ])
})

test('a sample column named like a variant field keeps its own row', () => {
  const rows = getTooltipRows({
    name: 'HG001',
    genotype: '0|1',
    description: '',
    sample: { name: 'HG001', description: 'proband', genotype: 'array' },
  })
  expect(rows).toEqual([
    { key: 'genotype', label: 'Genotype', value: '0|1' },
    { key: 'sample.description', label: 'Description', value: 'proband' },
    { key: 'sample.genotype', label: 'Genotype', value: 'array' },
  ])
})

test('raw feature id is not shown', () => {
  const rows = getTooltipRows({
    name: 'HG001',
    genotype: '0|1',
    featureId: 'ctgA-1234-5678-abcd',
  })
  expect(rows).toEqual([{ key: 'genotype', label: 'Genotype', value: '0|1' }])
})

test('empty and undefined values are skipped', () => {
  const rows = getTooltipRows({
    genotype: '0|1',
    description: '',
    length: undefined,
    sample: { name: 'HG001', population: 'EUR', batch: '' },
  })
  expect(rows.map(r => r.key)).toEqual(['genotype', 'sample.population'])
})
