import { modificationRegex, parseModHeader } from './consts.ts'

// Test that our regex matches the HTS-specs MM:Z tag format with documented divergences
// Spec regex: ([ACGTUN][-+]([a-z]+|[0-9]+)[.?]?(,[0-9]+)*;)*
// Our divergences from the official spec:
//   1. Capture strand ([-+]) as group 2 for downstream processing (spec doesn't)
//   2. Accept uppercase single letters [A-Z] in addition to lowercase (spec forbids this)
//      - Real-world BAMs contain uppercase codes (e.g., C+A, A+G) not in the spec
//   3. Use non-capturing group for modifiers (?:[.?]?) instead of capturing (spec captures)
//   4. Only match the header part (caller handles comma-separated deltas and semicolons)

describe('modificationRegex - HTS-specs compliance with documented divergences', () => {
  test('matches base modification code without modifiers', () => {
    const match = modificationRegex.exec('C+m')
    expect(match).toHaveLength(4)
    expect(match?.[1]).toBe('C')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('m')
    expect(match?.[4]).toBeUndefined()
  })

  test('matches with ? modifier (unknown status)', () => {
    const match = modificationRegex.exec('C+m?')
    expect(match?.[1]).toBe('C')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('m')
    expect(match?.[4]).toBeUndefined()
  })

  test('matches with . modifier (skip-this-base)', () => {
    const match = modificationRegex.exec('C+m.')
    expect(match?.[1]).toBe('C')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('m')
    expect(match?.[4]).toBeUndefined()
  })

  test('matches multi-type lowercase codes', () => {
    const match = modificationRegex.exec('C+mh')
    expect(match?.[1]).toBe('C')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('mh')
  })

  test('matches uppercase ambiguity codes', () => {
    const match = modificationRegex.exec('A+A')
    expect(match?.[1]).toBe('A')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('A')
  })

  test('matches ChEBI codes (all digits)', () => {
    const match = modificationRegex.exec('C+16061')
    expect(match?.[1]).toBe('C')
    expect(match?.[2]).toBe('+')
    expect(match?.[3]).toBe('16061')
  })

  test('matches negative strand', () => {
    const match = modificationRegex.exec('T-a')
    expect(match?.[1]).toBe('T')
    expect(match?.[2]).toBe('-')
    expect(match?.[3]).toBe('a')
  })

  test('group 4 is non-capturing (modifier not captured)', () => {
    const match = modificationRegex.exec('C+m?')
    // Group 4 should be undefined because it's non-capturing (?:[.?]?)
    expect(match?.length).toBe(4)
    expect(match?.[4]).toBeUndefined()
  })

  // Divergence 1: We capture strand as group 2, spec doesn't
  test('divergence 1: captures strand as group 2 for downstream use', () => {
    const match = modificationRegex.exec('C+m')
    expect(match?.[2]).toBe('+') // We capture this, spec doesn't
  })

  test('divergence 1: negative strand capture', () => {
    const match = modificationRegex.exec('T-a')
    expect(match?.[2]).toBe('-') // Needed for strand-specific processing
  })

  // Divergence 2: We accept uppercase single-letter codes NOT in the official spec
  // The spec only allows lowercase [a-z]+ or [0-9]+, but real-world BAMs contain
  // uppercase codes like C+A, A+G that appear to be undocumented extensions
  test('divergence 2: accepts uppercase single-letter codes (not in spec but in real BAMs)', () => {
    // C+A: not in spec, but appears in real BAM files
    const match = modificationRegex.exec('C+A')
    expect(match?.[3]).toBe('A')
  })

  test('divergence 2: another uppercase code example from real BAMs', () => {
    // A+G: not in spec, but appears in real BAM files
    const match = modificationRegex.exec('A+G')
    expect(match?.[3]).toBe('G')
  })
})

describe('parseModHeader with modifiers', () => {
  test('parseModHeader ignores ? modifier', () => {
    const result = parseModHeader('C+m?', 'C+m?,0,1;')
    expect(result).toEqual({
      base: 'C',
      strand: '+',
      typestr: 'm',
    })
  })

  test('parseModHeader ignores . modifier', () => {
    const result = parseModHeader('C+m.', 'C+m.,0,1;')
    expect(result).toEqual({
      base: 'C',
      strand: '+',
      typestr: 'm',
    })
  })

  test('parseModHeader with multi-type and modifier', () => {
    const result = parseModHeader('C+mh?', 'C+mh?,0,1;')
    expect(result).toEqual({
      base: 'C',
      strand: '+',
      typestr: 'mh',
    })
  })
})
