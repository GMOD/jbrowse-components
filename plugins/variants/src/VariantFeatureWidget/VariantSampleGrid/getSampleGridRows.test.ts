import { getSampleGridRows } from './getSampleGridRows.ts'

const samples = {
  HG001: { GT: ['0/1'] },
  HG002: { GT: ['1/1'] },
  HG003: { GT: ['./.'] },
}

test('passes through raw GT and resolves genotype by default', () => {
  const { rows, error } = getSampleGridRows(samples, 'A', ['T'], {})
  expect(error).toBeUndefined()
  expect(rows.map(r => [r.sample, r.GT, r.genotype])).toEqual([
    ['HG001', '0/1', 'ref(A)/T'],
    ['HG002', '1/1', 'T/T'],
    ['HG003', './.', './.'],
  ])
})

test('useCounts converts GT and genotype to allele dosage', () => {
  const { rows } = getSampleGridRows(samples, 'A', ['T'], {}, true)
  expect(rows.map(r => [r.GT, r.genotype])).toEqual([
    ['0:1;1:1', 'ref(A):1;T:1'],
    ['1:2', 'T:2'],
    ['.:2', '.:2'],
  ])
})

test('a sample without a GT call yields empty string GT/genotype, not undefined', () => {
  const { rows } = getSampleGridRows({ HG001: { DP: [30] } }, 'A', ['T'], {})
  expect(rows.map(r => [r.sample, r.GT, r.genotype, r.DP])).toEqual([
    ['HG001', '', '', '30'],
  ])
})

test('filter applies a case-insensitive regex per column', () => {
  const { rows } = getSampleGridRows(samples, 'A', ['T'], {
    sample: 'hg00[12]',
  })
  expect(rows.map(r => r.sample)).toEqual(['HG001', 'HG002'])
})
