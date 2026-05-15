import { buildColToGenomePos, findRefSampleIndex } from './colToGenomePos.ts'

describe('findRefSampleIndex', () => {
  const samples = [
    { id: 'mm10', label: 'Mouse' },
    { id: 'hg38', label: 'Human' },
    { id: 'panTro6', label: 'Chimp' },
  ]

  test('returns index of sample matching assemblyName', () => {
    expect(findRefSampleIndex(samples, 'hg38')).toBe(1)
    expect(findRefSampleIndex(samples, 'mm10')).toBe(0)
    expect(findRefSampleIndex(samples, 'panTro6')).toBe(2)
  })

  test('returns 0 when no match found', () => {
    expect(findRefSampleIndex(samples, 'galGal6')).toBe(0)
  })

  test('returns 0 when samples is undefined', () => {
    expect(findRefSampleIndex(undefined, 'hg38')).toBe(0)
  })

  test('returns 0 when assemblyName is undefined', () => {
    expect(findRefSampleIndex(samples, undefined)).toBe(0)
  })

  test('returns 0 when both are undefined', () => {
    expect(findRefSampleIndex(undefined, undefined)).toBe(0)
  })

  test('returns 0 for empty samples array', () => {
    expect(findRefSampleIndex([], 'hg38')).toBe(0)
  })
})

describe('buildColToGenomePos', () => {
  test('maps non-gap characters to sequential genomic positions', () => {
    const result = buildColToGenomePos('ACGT', 100)
    expect(result).toEqual([100, 101, 102, 103])
  })

  test('maps gaps to undefined', () => {
    const result = buildColToGenomePos('AC-GT', 100)
    expect(result).toEqual([100, 101, undefined, 102, 103])
  })

  test('handles multiple consecutive gaps', () => {
    const result = buildColToGenomePos('A--G', 100)
    expect(result).toEqual([100, undefined, undefined, 101])
  })

  test('handles gaps at start', () => {
    const result = buildColToGenomePos('--ACG', 100)
    expect(result).toEqual([undefined, undefined, 100, 101, 102])
  })

  test('handles gaps at end', () => {
    const result = buildColToGenomePos('ACG--', 100)
    expect(result).toEqual([100, 101, 102, undefined, undefined])
  })

  test('handles all gaps', () => {
    const result = buildColToGenomePos('----', 100)
    expect(result).toEqual([undefined, undefined, undefined, undefined])
  })

  test('handles empty sequence', () => {
    const result = buildColToGenomePos('', 100)
    expect(result).toEqual([])
  })

  test('works with different start positions', () => {
    const result = buildColToGenomePos('AC-T', 50000)
    expect(result).toEqual([50000, 50001, undefined, 50002])
  })
})

describe('integration: hover highlight with gaps', () => {
  const samples = [
    { id: 'mm10', label: 'Mouse' },
    { id: 'hg38', label: 'Human' },
    { id: 'panTro6', label: 'Chimp' },
  ]

  test('gap in non-reference sample does not affect mapping', () => {
    // Reference is hg38 (index 1)
    // mm10 (index 0) has a gap, but hg38 does not
    const sequences = [
      'A-GT', // mm10 - has gap at position 1
      'ACGT', // hg38 - no gap (this is the reference)
      'ACGT', // panTro6
    ]

    const refIdx = findRefSampleIndex(samples, 'hg38')
    expect(refIdx).toBe(1)

    const mapping = buildColToGenomePos(sequences[refIdx]!, 100)
    // All positions should map to genomic coordinates since reference has no gaps
    expect(mapping).toEqual([100, 101, 102, 103])
  })

  test('gap in reference sample maps to undefined', () => {
    // Reference is hg38 (index 1)
    // hg38 has a gap (insertion in other species)
    const sequences = [
      'ACGT', // mm10
      'A-GT', // hg38 - has gap (this is the reference)
      'ATGT', // panTro6 - has T where hg38 has gap
    ]

    const refIdx = findRefSampleIndex(samples, 'hg38')
    const mapping = buildColToGenomePos(sequences[refIdx]!, 100)
    // Position 1 should be undefined because reference has gap there
    expect(mapping).toEqual([100, undefined, 101, 102])
  })

  test('correctly handles reference as first sample', () => {
    // Reference is mm10 (index 0)
    const sequences = [
      'ACGT', // mm10 - reference
      'A-GT', // hg38 - has gap
      'ACGT', // panTro6
    ]

    const refIdx = findRefSampleIndex(samples, 'mm10')
    expect(refIdx).toBe(0)

    const mapping = buildColToGenomePos(sequences[refIdx]!, 100)
    // All positions map because reference (mm10) has no gaps
    expect(mapping).toEqual([100, 101, 102, 103])
  })

  test('correctly handles reference as last sample', () => {
    // Reference is panTro6 (index 2)
    const sequences = [
      'A-GT', // mm10 - has gap
      'A-GT', // hg38 - has gap
      'ACGT', // panTro6 - no gap (this is the reference)
    ]

    const refIdx = findRefSampleIndex(samples, 'panTro6')
    expect(refIdx).toBe(2)

    const mapping = buildColToGenomePos(sequences[refIdx]!, 100)
    // All positions map because reference (panTro6) has no gaps
    expect(mapping).toEqual([100, 101, 102, 103])
  })

  test('falls back to first sample when assembly not found', () => {
    // Reference is galGal6 which doesn't exist in samples
    const sequences = [
      'ACGT', // mm10
      'A-GT', // hg38
      'ACGT', // panTro6
    ]

    const refIdx = findRefSampleIndex(samples, 'galGal6')
    expect(refIdx).toBe(0) // Falls back to first sample

    const mapping = buildColToGenomePos(sequences[refIdx]!, 100)
    expect(mapping).toEqual([100, 101, 102, 103])
  })
})
