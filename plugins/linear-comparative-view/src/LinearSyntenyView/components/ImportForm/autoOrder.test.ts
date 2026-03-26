import { computeGenomeOrdering } from './autoOrder.ts'

test('returns empty for no records', () => {
  expect(computeGenomeOrdering([])).toEqual([])
})

test('returns both genomes for a single pair', () => {
  const result = computeGenomeOrdering([
    { qname: 'hg38', tname: 'mm39', alignmentLength: 1000 },
  ])
  expect(result).toHaveLength(2)
  expect(result).toContain('hg38')
  expect(result).toContain('mm39')
})

test('orders three genomes by maximum coverage adjacency', () => {
  const records = [
    { qname: 'hg38', tname: 'mm39', alignmentLength: 5000 },
    { qname: 'mm39', tname: 'rn7', alignmentLength: 8000 },
    { qname: 'hg38', tname: 'rn7', alignmentLength: 1000 },
  ]
  const result = computeGenomeOrdering(records)
  expect(result).toHaveLength(3)

  // mm39 has highest total coverage (5000+8000=13000), so starts there
  // From mm39, rn7 has 8000 coverage vs hg38's 5000, so rn7 is next
  // hg38 is last
  expect(result[0]).toBe('mm39')
  expect(result[1]).toBe('rn7')
  expect(result[2]).toBe('hg38')
})

test('handles four genomes', () => {
  const records = [
    { qname: 'A', tname: 'B', alignmentLength: 100 },
    { qname: 'B', tname: 'C', alignmentLength: 200 },
    { qname: 'C', tname: 'D', alignmentLength: 150 },
    { qname: 'A', tname: 'D', alignmentLength: 10 },
  ]
  const result = computeGenomeOrdering(records)
  expect(result).toHaveLength(4)
  expect(new Set(result)).toEqual(new Set(['A', 'B', 'C', 'D']))
})

test('accumulates alignment lengths for repeated pairs', () => {
  const records = [
    { qname: 'hg38', tname: 'mm39', alignmentLength: 100 },
    { qname: 'hg38', tname: 'mm39', alignmentLength: 200 },
    { qname: 'hg38', tname: 'rn7', alignmentLength: 50 },
  ]
  const result = computeGenomeOrdering(records)
  expect(result).toHaveLength(3)
  // hg38 total=350, mm39 total=300, rn7 total=50
  // Start from hg38, pick mm39 (300 coverage), then rn7
  expect(result[0]).toBe('hg38')
  expect(result[1]).toBe('mm39')
  expect(result[2]).toBe('rn7')
})

test('returns single genome list for two genomes', () => {
  const records = [{ qname: 'A', tname: 'B', alignmentLength: 500 }]
  const result = computeGenomeOrdering(records)
  expect(result).toEqual(['A', 'B'])
})
