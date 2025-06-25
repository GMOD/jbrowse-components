import { expect, test } from 'vitest'

import { extractSubsequence } from './extractSubsequence'

test('extracts a simple subsequence without gaps', () => {
  const sequence = 'ACGTACGT'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 2, 6)

  expect(extractedSequence).toBe('GTAC')
  expect(actualStart).toBe(2)
})

test('handles gaps in the sequence correctly', () => {
  const sequence = 'A-CGT-ACGT'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 2, 6)

  // Gaps are not counted toward positions, so positions 2-6 would be G,T,A,C
  expect(extractedSequence).toBe('GT-AC')
  expect(actualStart).toBe(3)
})

test('handles subsequence at the start of the sequence', () => {
  const sequence = 'ACGTACGT'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 0, 3)

  expect(extractedSequence).toBe('ACG')
  expect(actualStart).toBe(0)
})

test('handles subsequence at the end of the sequence', () => {
  const sequence = 'ACGTACGT'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 5, 8)

  expect(extractedSequence).toBe('CGT')
  expect(actualStart).toBe(5)
})

test('handles a sequence with only gaps', () => {
  const sequence = '----'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 0, 2)

  // Since there are no non-gap characters, the subsequence should be the entire string
  expect(extractedSequence).toBe('----')
  expect(actualStart).toBe(0)
})

test('handles a sequence with mixed characters and gaps', () => {
  const sequence = 'A--CGT--ACGT'
  const { extractedSequence, actualStart } = extractSubsequence(sequence, 2, 5)

  // Positions 2-5 would be G,T,A after skipping gaps
  expect(extractedSequence).toBe('GT--A')
  expect(actualStart).toBe(5)
})
