import {
  classifyVariantFeatures,
  getBadlyPairedAlignments,
  getMatchedBreakendFeatures,
  getMatchedTranslocationFeatures,
} from './util.ts'

import type { Feature } from '@jbrowse/core/util'

function fakeFeature(id: string, type: string) {
  return {
    id: () => id,
    get: (k: string) => (k === 'type' ? type : undefined),
  } as unknown as Feature
}

// BND features carry refName, start (0-based), and ALT with a breakend string
// parseable by @gmod/vcf's parseBreakend, e.g. "N]chr2:200]"
function fakeBnd(
  id: string,
  refName: string,
  start: number,
  mateRef: string,
  matePos1Based: number,
) {
  const fields: Record<string, unknown> = {
    type: 'breakend',
    refName,
    start,
    ALT: [`N]${mateRef}:${matePos1Based}]`],
  }
  return {
    id: () => id,
    get: (k: string) => fields[k],
  } as unknown as Feature
}

function mapOf(...feats: Feature[]) {
  return new Map(feats.map(f => [f.id(), f] as const))
}

describe('getMatchedBreakendFeatures', () => {
  // A at chr1:100 (0-based) = position 101 (1-based) pointing to chr2:200
  // B at chr2:199 (0-based) = position 200 (1-based) pointing to chr1:101
  const A = fakeBnd('a', 'chr1', 100, 'chr2', 200)
  const B = fakeBnd('b', 'chr2', 199, 'chr1', 101)

  test('pairs two mutually-referencing BND features', () => {
    const result = getMatchedBreakendFeatures(mapOf(A, B))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(2)
  })

  test('result is the same regardless of iteration order', () => {
    expect(getMatchedBreakendFeatures(mapOf(A, B))).toHaveLength(1)
    expect(getMatchedBreakendFeatures(mapOf(B, A))).toHaveLength(1)
  })

  test('unpaired BND produces no matches', () => {
    expect(getMatchedBreakendFeatures(mapOf(A))).toHaveLength(0)
  })

  test('two independent BND pairs produce two groups', () => {
    const C = fakeBnd('c', 'chr3', 0, 'chr4', 500)
    const D = fakeBnd('d', 'chr4', 499, 'chr3', 1)
    const result = getMatchedBreakendFeatures(mapOf(A, B, C, D))
    expect(result).toHaveLength(2)
  })

  test('two BNDs sharing the same MatePosition are not incorrectly merged', () => {
    // E and F both point to chr2:200, but are not mates of each other
    const E = fakeBnd('e', 'chr5', 0, 'chr2', 200)
    const F = fakeBnd('f', 'chr6', 0, 'chr2', 200)
    // B is the real mate of A; E and F are orphans pointing to the same spot
    const result = getMatchedBreakendFeatures(mapOf(A, B, E, F))
    // only the real A-B pair should match; E and F land in different buckets
    expect(result).toHaveLength(1)
  })
})

describe('getMatchedTranslocationFeatures', () => {
  function fakeTra(id: string, alt: string[] | undefined) {
    return {
      id: () => id,
      get: (k: string) => (k === 'ALT' ? alt : undefined),
    } as unknown as Feature
  }

  test('includes features with <TRA> ALT', () => {
    const t = fakeTra('a', ['<TRA>'])
    const result = getMatchedTranslocationFeatures(mapOf(t))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(t)
  })

  test('excludes features with non-TRA ALT', () => {
    const t = fakeTra('a', ['<DEL>'])
    expect(getMatchedTranslocationFeatures(mapOf(t))).toHaveLength(0)
  })

  test('does not throw when ALT is undefined', () => {
    const t = fakeTra('a', undefined)
    expect(() => getMatchedTranslocationFeatures(mapOf(t))).not.toThrow()
    expect(getMatchedTranslocationFeatures(mapOf(t))).toHaveLength(0)
  })

  test('returns one group per TRA feature', () => {
    const a = fakeTra('a', ['<TRA>'])
    const b = fakeTra('b', ['<TRA>'])
    const result = getMatchedTranslocationFeatures(mapOf(a, b))
    expect(result).toHaveLength(2)
  })
})

describe('classifyVariantFeatures', () => {
  test('translocation wins over paired_feature and breakend', () => {
    expect(
      classifyVariantFeatures(
        mapOf(
          fakeFeature('a', 'paired_feature'),
          fakeFeature('b', 'translocation'),
          fakeFeature('c', 'breakend'),
        ),
      ),
    ).toBe('translocation')
  })

  test('paired wins over breakend', () => {
    expect(
      classifyVariantFeatures(
        mapOf(fakeFeature('a', 'breakend'), fakeFeature('b', 'paired_feature')),
      ),
    ).toBe('paired')
  })

  test('defaults to breakend', () => {
    expect(classifyVariantFeatures(mapOf(fakeFeature('a', 'breakend')))).toBe(
      'breakend',
    )
  })

  test('empty defaults to breakend', () => {
    expect(classifyVariantFeatures(new Map())).toBe('breakend')
  })
})

describe('getBadlyPairedAlignments', () => {
  function fakeAlignment(
    id: string,
    name: string,
    refName: string,
    start: number,
    end: number,
    flags: number,
    pairOrientation?: string,
  ) {
    return {
      id: () => id,
      get: (k: string) => {
        switch (k) {
          case 'name':
            return name
          case 'refName':
            return refName
          case 'start':
            return start
          case 'end':
            return end
          case 'flags':
            return flags
          case 'pair_orientation':
            return pairOrientation
          default:
            return undefined
        }
      },
    } as unknown as Feature
  }

  // SAM flags: 0x02 = properly paired, 0x04 = unmapped, 0x01 = paired
  const PAIRED = 0x01
  const PROPERLY_PAIRED = 0x02
  const UNMAPPED = 0x04

  test('includes unproperly paired reads (no proper pair flag)', () => {
    const read1 = fakeAlignment(
      'read1/1',
      'read1',
      'chr1',
      100,
      150,
      PAIRED,
      'F1R2',
    )
    const read2 = fakeAlignment(
      'read1/2',
      'read1',
      'chr1',
      200,
      250,
      PAIRED,
      'F1R2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(read1)
    expect(result[0]).toContain(read2)
  })

  test('includes properly paired reads with mis-oriented pair orientation (F1F2)', () => {
    const read1 = fakeAlignment(
      'read2/1',
      'read2',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      'F1F2',
    )
    const read2 = fakeAlignment(
      'read2/2',
      'read2',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      'F1F2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(read1)
    expect(result[0]).toContain(read2)
  })

  test('includes properly paired reads with mis-oriented pair orientation (R1R2)', () => {
    const read1 = fakeAlignment(
      'read3/1',
      'read3',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      'R1R2',
    )
    const read2 = fakeAlignment(
      'read3/2',
      'read3',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      'R1R2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(read1)
    expect(result[0]).toContain(read2)
  })

  test('excludes properly paired reads with proper orientation (F1R2)', () => {
    const read1 = fakeAlignment(
      'read4/1',
      'read4',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      'F1R2',
    )
    const read2 = fakeAlignment(
      'read4/2',
      'read4',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      'F1R2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(0)
  })

  test('excludes unmapped reads', () => {
    const read1 = fakeAlignment(
      'read5/1',
      'read5',
      'chr1',
      100,
      150,
      PAIRED | UNMAPPED,
      'F1F2',
    )
    const read2 = fakeAlignment(
      'read5/2',
      'read5',
      'chr1',
      200,
      250,
      PAIRED | UNMAPPED,
      'F1F2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(0)
  })

  test('excludes single reads (need at least 2 with same name)', () => {
    const read1 = fakeAlignment('read6', 'read6', 'chr1', 100, 150, PAIRED, 'F1F2')
    const result = getBadlyPairedAlignments(mapOf(read1))
    expect(result).toHaveLength(0)
  })

  test('handles F2F1 mis-orientation (equivalent to F1F2)', () => {
    const read1 = fakeAlignment(
      'read7/1',
      'read7',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      'F2F1',
    )
    const read2 = fakeAlignment(
      'read7/2',
      'read7',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      'F2F1',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(read1)
    expect(result[0]).toContain(read2)
  })

  test('handles R2R1 mis-orientation (equivalent to R1R2)', () => {
    const read1 = fakeAlignment(
      'read8/1',
      'read8',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      'R2R1',
    )
    const read2 = fakeAlignment(
      'read8/2',
      'read8',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      'R2R1',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toContain(read1)
    expect(result[0]).toContain(read2)
  })

  test('handles undefined pair_orientation (treats as properly paired)', () => {
    const read1 = fakeAlignment(
      'read9/1',
      'read9',
      'chr1',
      100,
      150,
      PAIRED | PROPERLY_PAIRED,
      undefined,
    )
    const read2 = fakeAlignment(
      'read9/2',
      'read9',
      'chr1',
      200,
      250,
      PAIRED | PROPERLY_PAIRED,
      undefined,
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read2))
    expect(result).toHaveLength(0)
  })

  test('filters out duplicates at same location', () => {
    const read1 = fakeAlignment(
      'read10/1',
      'read10',
      'chr1',
      100,
      150,
      PAIRED,
      'F1F2',
    )
    const read1Dup = fakeAlignment(
      'read10/1-dup',
      'read10',
      'chr1',
      100,
      150,
      PAIRED,
      'F1F2',
    )
    const read2 = fakeAlignment(
      'read10/2',
      'read10',
      'chr1',
      200,
      250,
      PAIRED,
      'F1F2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1, read1Dup, read2))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(2)
  })

  test('separates different read pairs by name', () => {
    const read1A = fakeAlignment(
      'read11a/1',
      'read11a',
      'chr1',
      100,
      150,
      PAIRED,
      'F1F2',
    )
    const read2A = fakeAlignment(
      'read11a/2',
      'read11a',
      'chr1',
      200,
      250,
      PAIRED,
      'F1F2',
    )
    const read1B = fakeAlignment(
      'read11b/1',
      'read11b',
      'chr1',
      300,
      350,
      PAIRED,
      'F1F2',
    )
    const read2B = fakeAlignment(
      'read11b/2',
      'read11b',
      'chr1',
      400,
      450,
      PAIRED,
      'F1F2',
    )
    const result = getBadlyPairedAlignments(mapOf(read1A, read2A, read1B, read2B))
    expect(result).toHaveLength(2)
  })

  test('combines unproperly paired and mis-oriented in same query', () => {
    const improperly = fakeAlignment(
      'read12/1',
      'read12',
      'chr1',
      100,
      150,
      PAIRED,
      'F1R2',
    )
    const improperlyMate = fakeAlignment(
      'read12/2',
      'read12',
      'chr1',
      200,
      250,
      PAIRED,
      'F1R2',
    )
    const misoriented = fakeAlignment(
      'read13/1',
      'read13',
      'chr1',
      300,
      350,
      PAIRED | PROPERLY_PAIRED,
      'F1F2',
    )
    const misorientedMate = fakeAlignment(
      'read13/2',
      'read13',
      'chr1',
      400,
      450,
      PAIRED | PROPERLY_PAIRED,
      'F1F2',
    )
    const result = getBadlyPairedAlignments(
      mapOf(improperly, improperlyMate, misoriented, misorientedMate),
    )
    expect(result).toHaveLength(2)
  })
})
