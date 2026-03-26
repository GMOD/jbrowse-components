import { extractLargeIndels } from './cigar-utils.ts'

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
