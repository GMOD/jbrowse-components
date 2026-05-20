import { computeDeFromCigar, extractLargeIndels } from './cigar-utils.ts'

test('computeDeFromCigar with =/X computes divergence', () => {
  // 98 matches, 2 mismatches, no indels → de = 2/100 = 0.02
  expect(computeDeFromCigar('98=2X')).toBeCloseTo(0.02, 5)
})

test('computeDeFromCigar counts each indel run as one event', () => {
  // 100 matches, 1 insertion event, 1 deletion event
  // → de = 1 - 100/(100+0+1+1) = 1 - 100/102
  expect(computeDeFromCigar('50=10I50=20D')).toBeCloseTo(1 - 100 / 102, 5)
})

test('computeDeFromCigar returns undefined for M-only CIGARs', () => {
  expect(computeDeFromCigar('100M5D50M')).toBeUndefined()
})

test('computeDeFromCigar returns undefined for empty CIGAR', () => {
  expect(computeDeFromCigar('')).toBeUndefined()
})

test('computeDeFromCigar returns 0 for a perfect = run', () => {
  expect(computeDeFromCigar('100=')).toBe(0)
})

test('extracts large deletions with absolute positions', () => {
  const cigar = '1000M5000D2000M'
  const result = extractLargeIndels(cigar, 1000, 100, 200)
  // Deletion at refPos=1100 (100+1000), queryPos=1200 (200+1000), len=5000
  expect(result).toBe('id:Z:D1100,1200,5000')
})

test('extracts large insertions', () => {
  const cigar = '500M3000I500M'
  const result = extractLargeIndels(cigar, 1000, 0, 0)
  expect(result).toBe('id:Z:I500,500,3000')
})

test('extracts multiple indels', () => {
  const cigar = '1000M2000D500M3000I1000M'
  const result = extractLargeIndels(cigar, 1000, 0, 0)
  expect(result).toBe('id:Z:D1000,1000,2000;I3500,1500,3000')
})

test('returns empty string when no large indels', () => {
  const cigar = '1000M500D2000M'
  const result = extractLargeIndels(cigar, 1000, 0, 0)
  expect(result).toBe('')
})

test('handles empty cigar', () => {
  expect(extractLargeIndels('', 1000, 0, 0)).toBe('')
})
