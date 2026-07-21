import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
} from '@jbrowse/cigar-utils'

import { buildConsensusTally, computeConsensus } from './computeConsensus.ts'

import type { ConsensusFeature, ConsensusOptions } from './computeConsensus.ts'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

interface ReadSpec {
  start: number
  end: number
  mismatches?: { pos: number; base: string }[]
  dels?: { pos: number; len: number }[]
  skips?: { pos: number; len: number }[]
  ins?: { afterPos: number; bases: string }[]
}

function mockFeature(r: ReadSpec): ConsensusFeature {
  return {
    get(field: string) {
      if (field === 'start') {
        return r.start
      }
      if (field === 'end') {
        return r.end
      }
      return undefined
    },
    forEachMismatch(cb: MismatchCallback) {
      for (const m of r.mismatches ?? []) {
        cb(MISMATCH_TYPE, m.pos - r.start, 1, m.base, -1, 0, 0)
      }
      for (const d of r.dels ?? []) {
        cb(DELETION_TYPE, d.pos - r.start, d.len, '*', -1, 0, 0)
      }
      for (const s of r.skips ?? []) {
        cb(SKIP_TYPE, s.pos - r.start, s.len, 'N', -1, 0, 0)
      }
      for (const i of r.ins ?? []) {
        cb(
          INSERTION_TYPE,
          i.afterPos + 1 - r.start,
          0,
          i.bases,
          -1,
          0,
          i.bases.length,
        )
      }
    },
  }
}

function run(
  reference: string,
  reads: ReadSpec[],
  opts: ConsensusOptions = {},
  region = { start: 0, end: reference.length },
) {
  const tally = buildConsensusTally(reads.map(mockFeature), region)
  return computeConsensus(reference, tally, opts)
}

function times(count: number, r: ReadSpec) {
  return Array.from({ length: count }, () => r)
}

describe('computeConsensus', () => {
  test('all reads matching the reference reproduce it', () => {
    expect(run('ACGTACGT', times(5, { start: 0, end: 8 }))).toBe('ACGTACGT')
  })

  test('majority mismatch base wins the column', () => {
    const reads = times(4, {
      start: 0,
      end: 4,
      mismatches: [{ pos: 1, base: 'G' }],
    }).concat({ start: 0, end: 4 })
    expect(run('AAAA', reads)).toBe('AGAA')
  })

  test('no base clearing the 0.75 call fraction is N (6A 5G 4C)', () => {
    const reads = [
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
      ...times(4, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'C' }] }),
      ...times(6, { start: 0, end: 1 }),
    ]
    expect(run('A', reads)).toBe('N')
  })

  test('depth below minDepth is N', () => {
    expect(run('A', times(5, { start: 0, end: 1 }), { minDepth: 10 })).toBe('N')
  })

  test('majority deletion is omitted by default (gapless, samtools parity)', () => {
    const reads = times(4, {
      start: 0,
      end: 4,
      dels: [{ pos: 1, len: 1 }],
    }).concat({ start: 0, end: 4 })
    expect(run('ACGT', reads)).toBe('AGT')
  })

  test('gapChar keeps the deletion in the alignment frame', () => {
    const reads = times(4, {
      start: 0,
      end: 4,
      dels: [{ pos: 1, len: 1 }],
    }).concat({ start: 0, end: 4 })
    expect(run('ACGT', reads, { gapChar: '-' })).toBe('A-GT')
  })

  test('majority insertion is inserted into the consensus', () => {
    const reads = times(4, {
      start: 0,
      end: 3,
      ins: [{ afterPos: 0, bases: 'TT' }],
    }).concat({ start: 0, end: 3 })
    expect(run('ACG', reads)).toBe('ATTCG')
  })

  test('minority insertion is dropped', () => {
    const reads = [
      { start: 0, end: 3, ins: [{ afterPos: 0, bases: 'TT' }] },
      ...times(4, { start: 0, end: 3 }),
    ]
    expect(run('ACG', reads)).toBe('ACG')
  })

  test('includeInsertions=false keeps the reference coordinate frame', () => {
    const reads = times(4, {
      start: 0,
      end: 3,
      ins: [{ afterPos: 0, bases: 'TT' }],
    }).concat({ start: 0, end: 3 })
    expect(run('ACG', reads, { includeInsertions: false })).toBe('ACG')
  })

  test('N-skip (intron) does not inflate reference-match count', () => {
    // Every read splices out position 1; without SKIP subtraction the implied
    // reference-match count would wrongly call it 'C'.
    const reads = times(5, { start: 0, end: 4, skips: [{ pos: 1, len: 1 }] })
    expect(run('ACGT', reads)).toBe('ANGT')
  })

  test('uncovered positions are N', () => {
    const reads = [{ start: 2, end: 4 }]
    expect(run('ACGT', reads)).toBe('NNGT')
  })

  test('N read bases dilute like samtools (8A + 2N still calls A)', () => {
    const reads = [
      ...times(8, { start: 0, end: 1 }),
      ...times(2, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'N' }] }),
    ]
    expect(run('A', reads)).toBe('A')
  })

  test('enough N bases push the call below the fraction to N (4A + 6N)', () => {
    // refMatch A weight 4*8=32; 6 N spread 6 across each base; tscore 56;
    // 32 < 0.75*56=42 -> N, matching samtools seqi weighting.
    const reads = [
      ...times(4, { start: 0, end: 1 }),
      ...times(6, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'N' }] }),
    ]
    expect(run('A', reads)).toBe('N')
  })
})
