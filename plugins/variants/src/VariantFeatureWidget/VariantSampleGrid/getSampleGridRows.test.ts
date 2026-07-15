import {
  filterSampleRows,
  getAlleleFrequencies,
  getSampleGridRows,
} from './getSampleGridRows.ts'

const samples = {
  HG001: { GT: ['0/1'] },
  HG002: { GT: ['1/1'] },
  HG003: { GT: ['./.'] },
}

test('passes through raw GT and resolves genotype by default', () => {
  const rows = getSampleGridRows(samples, 'A', ['T'])
  expect(rows.map(r => [r.sample, r.GT, r.genotype])).toEqual([
    ['HG001', '0/1', 'ref(A)/T'],
    ['HG002', '1/1', 'T/T'],
    ['HG003', './.', './.'],
  ])
})

test('useCounts converts GT and genotype to allele dosage', () => {
  const rows = getSampleGridRows(samples, 'A', ['T'], true)
  expect(rows.map(r => [r.GT, r.genotype])).toEqual([
    ['0:1;1:1', 'ref(A):1;T:1'],
    ['1:2', 'T:2'],
    ['.:2', '.:2'],
  ])
})

test('a sample without a GT call yields empty string GT/genotype, not undefined', () => {
  const rows = getSampleGridRows({ HG001: { DP: [30] } }, 'A', ['T'])
  expect(rows.map(r => [r.sample, r.GT, r.genotype, r.DP])).toEqual([
    ['HG001', '', '', '30'],
  ])
})

test('filter applies a case-insensitive regex per column', () => {
  const rows = getSampleGridRows(samples, 'A', ['T'])
  const { rows: filtered } = filterSampleRows(rows, { sample: 'hg00[12]' })
  expect(filtered.map(r => r.sample)).toEqual(['HG001', 'HG002'])
})

test('an invalid regex surfaces an error but keeps the rows', () => {
  const rows = getSampleGridRows(samples, 'A', ['T'])
  const { rows: filtered, error } = filterSampleRows(rows, { sample: '[' })
  expect(error).toBeDefined()
  expect(filtered).toBe(rows)
})

test('allele frequencies count called alleles, excluding missing', () => {
  // HG001 0/1, HG002 1/1, HG003 ./. -> ref x1, T x3, missing excluded
  expect(getAlleleFrequencies(samples, 'A', ['T'])).toEqual([
    { id: 'T', allele: 'T', count: 3, frequency: '75.0%' },
    { id: 'ref(A)', allele: 'ref(A)', count: 1, frequency: '25.0%' },
  ])
})

test('allele frequencies are empty when no sample has a GT call', () => {
  expect(getAlleleFrequencies({ HG001: { DP: [30] } }, 'A', ['T'])).toEqual([])
  expect(getAlleleFrequencies({}, 'A', ['T'])).toEqual([])
})
