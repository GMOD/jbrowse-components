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

  test('sub-threshold deletion is still called/omitted (samtools parity)', () => {
    // 3 del : 2 ref at pos 1 -> gap has plurality but only 60% < 0.75. samtools
    // consensus -a -m simple emits the deletion (gapless "AGTA"), unlike a
    // sub-threshold base which is N.
    const reads = [
      ...times(3, { start: 0, end: 5, dels: [{ pos: 1, len: 1 }] }),
      ...times(2, { start: 0, end: 5 }),
    ]
    expect(run('ACGTA', reads)).toBe('AGTA')
  })

  test('sub-threshold mismatch is N (samtools parity)', () => {
    // 3 G : 2 ref C at pos 1 -> 60% < 0.75, so N (contrast with the deletion).
    const reads = [
      ...times(3, { start: 0, end: 5, mismatches: [{ pos: 1, base: 'G' }] }),
      ...times(2, { start: 0, end: 5 }),
    ]
    expect(run('ACGTA', reads)).toBe('ANGTA')
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

// hetFract opts into IUPAC ambiguity (samtools `--ambig`); 0.5 is samtools'
// own --het-fract default. Left undefined above, so everything in the block
// above is plain `samtools consensus` behavior.
function runAmbig(
  reference: string,
  reads: ReadSpec[],
  opts: ConsensusOptions = {},
) {
  return run(reference, reads, { hetFract: 0.5, ...opts })
}

describe('computeConsensus with IUPAC ambiguity', () => {
  test.each([
    ['A', 'A'],
    ['C', 'C'],
    ['AC', 'M'],
    ['G', 'G'],
    ['AG', 'R'],
    ['CG', 'S'],
    ['ACG', 'V'],
    ['T', 'T'],
    ['AT', 'W'],
    ['CT', 'Y'],
    ['ACT', 'H'],
    ['GT', 'K'],
    ['AGT', 'D'],
    ['CGT', 'B'],
    ['ACGT', 'N'],
  ])('maps the pure-base set %s to IUPAC %s', (bases, expected) => {
    const reads = bases.split('').map(base => ({
      start: 0,
      end: 1,
      mismatches: [{ pos: 0, base }],
    }))
    expect(runAmbig('A', reads)).toBe(expected)
  })

  test.each('ACMGRSVTWYHKDBN'.split(''))(
    'round-trips the BAM IUPAC read code %s in either case',
    expected => {
      for (const base of [expected, expected.toLowerCase()]) {
        const reads = [
          {
            start: 0,
            end: 1,
            mismatches: [{ pos: 0, base }],
          },
        ]
        expect(runAmbig('A', reads)).toBe(expected)
      }
    },
  )

  test('preserves samtools integer weighting for mixed V and K observations', () => {
    const vote = (base: string): ReadSpec => ({
      start: 0,
      end: 1,
      mismatches: [{ pos: 0, base }],
    })
    // The upstream tables reproduced here for parity are asymmetric: V votes
    // A=2/C=2/G=1 and K votes G=4/T=8.
    expect(runAmbig('A', [vote('A'), vote('V')])).toBe('A')
    expect(runAmbig('A', [vote('G'), vote('K')])).toBe('K')
  })

  test('a minor mismatch too weak to clear hetFract is a clean majority call', () => {
    // G=32, A(ref)=8 of tscore=40. het-fract need = 0.5*32=16; A's 8 doesn't
    // clear it, so A is never folded in -> plain G, not an ambiguity code.
    const reads = times(4, {
      start: 0,
      end: 4,
      mismatches: [{ pos: 1, base: 'G' }],
    }).concat({ start: 0, end: 4 })
    expect(runAmbig('AAAA', reads)).toBe('AGAA')
  })

  test('a 60/40 split clears both thresholds and calls a heterozygous IUPAC code', () => {
    // A=48, G=32 of tscore=80. het-fract need=0.5*48=24; G's 32 clears it, so
    // both fold in (usedScore=80). call-fract need=0.75*80=60; 80 clears it
    // too -> R (A/G), matching real `samtools consensus -A` at its own
    // defaults for a genuine two-allele split.
    const reads = times(6, { start: 0, end: 1 }).concat(
      times(4, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
    )
    expect(runAmbig('A', reads)).toBe('R')
  })

  test('an uncapped 3-way split folds in all three bases (6A 5G 4C -> V)', () => {
    // A=48, G=40, C=32 of tscore=120. Winner is A (het-fract need=24); both G
    // (40) and C (32) clear it, so all three fold in (usedScore=120, clears
    // call-fract's 90 easily) -> V (A/C/G). Real samtools --ambig caps at the
    // top two (A+G only, 88/120=73% < 75% call-fract -> N per its own doc
    // comment) and would give up to N here; uncapped, the real 3rd allele is
    // represented instead of discarded. Without hetFract this same column is
    // the plain-mode 'no base clears the call fraction is N' case above.
    const reads = [
      ...times(6, { start: 0, end: 1 }),
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
      ...times(4, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'C' }] }),
    ]
    expect(runAmbig('A', reads)).toBe('V')
  })

  test('a genuine 4-way split reads as N — the one case IUPAC can\'t distinguish from "no idea"', () => {
    // Four comparably-supported alleles (10A/9C/8G/7T) all clear het-fract
    // relative to the 10-read winner, and their union trivially clears
    // call-fract (it's the whole column) -> mask covers all four bases, which
    // IUPAC also spells 'N'. A true tetraploid 4-allele site and "no signal at
    // all" are indistinguishable in IUPAC notation; this is a real limitation
    // of the notation, not of this algorithm.
    const reads = [
      ...times(10, { start: 0, end: 1 }),
      ...times(9, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'C' }] }),
      ...times(8, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
      ...times(7, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'T' }] }),
    ]
    expect(runAmbig('A', reads)).toBe('N')
  })

  test('gap plurality with substantial base support is lowercase ambiguity', () => {
    // 3 del : 2 ref C at pos 1. Both clear hetFract and together clear
    // callFract, so samtools -A's base/gap convention emits lowercase c.
    // Plain mode calls the deletion instead (gapless "AGTA").
    const reads = [
      ...times(3, { start: 0, end: 5, dels: [{ pos: 1, len: 1 }] }),
      ...times(2, { start: 0, end: 5 }),
    ]
    expect(runAmbig('ACGTA', reads)).toBe('AcGTA')
  })

  test('base plurality with substantial gap support is lowercase ambiguity', () => {
    const reads = [
      ...times(2, { start: 0, end: 5, dels: [{ pos: 1, len: 1 }] }),
      ...times(3, { start: 0, end: 5 }),
    ]
    expect(runAmbig('ACGTA', reads)).toBe('AcGTA')
  })

  test('uncapped multi-base plus gap support is lowercase IUPAC', () => {
    const reads = [
      ...times(4, { start: 0, end: 1 }),
      ...times(3, {
        start: 0,
        end: 1,
        mismatches: [{ pos: 0, base: 'G' }],
      }),
      ...times(2, {
        start: 0,
        end: 1,
        dels: [{ pos: 0, len: 1 }],
      }),
    ]
    expect(runAmbig('A', reads)).toBe('r')
  })

  test('minority insertion below hetFract is still dropped', () => {
    // 1 read inserted, 4 didn't -> the insertion doesn't clear het-fract
    // against the "no insertion" gap, so nothing is folded in.
    const reads = [
      { start: 0, end: 3, ins: [{ afterPos: 0, bases: 'TT' }] },
      ...times(4, { start: 0, end: 3 }),
    ]
    expect(runAmbig('ACG', reads)).toBe('ACG')
  })

  test.each([
    [3, 2],
    [2, 3],
  ])(
    '%i insertion reads versus %i non-insertion reads is lowercase ambiguity',
    (insertionReads, nonInsertionReads) => {
      const reads = [
        ...times(insertionReads, {
          start: 0,
          end: 3,
          ins: [{ afterPos: 0, bases: 'T' }],
        }),
        ...times(nonInsertionReads, { start: 0, end: 3 }),
      ]
      expect(runAmbig('ACG', reads)).toBe('AtCG')
    },
  )

  test('insertion tails fold multiple bases plus no-insertion gaps', () => {
    const reads = [
      ...times(4, {
        start: 0,
        end: 3,
        ins: [{ afterPos: 0, bases: 'AA' }],
      }),
      ...times(3, {
        start: 0,
        end: 3,
        ins: [{ afterPos: 0, bases: 'AG' }],
      }),
      ...times(2, {
        start: 0,
        end: 3,
        ins: [{ afterPos: 0, bases: 'A' }],
      }),
    ]
    expect(runAmbig('ACG', reads)).toBe('AArCG')
  })

  test('hetFract zero folds observed alleles but not zero-support bases', () => {
    expect(runAmbig('A', times(5, { start: 0, end: 1 }), { hetFract: 0 })).toBe(
      'A',
    )
  })

  test('N read bases dilute like samtools (8A + 2N still calls A)', () => {
    // A=34 (32 ref-match + 2 from N dilution), C=G=T=2 each, tscore=40. Each
    // of C/G/T (2) is far below het-fract's need (0.5*34=17), so none folds
    // in; A alone (34) clears call-fract's need (0.75*40=30) -> plain A.
    const reads = [
      ...times(8, { start: 0, end: 1 }),
      ...times(2, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'N' }] }),
    ]
    expect(runAmbig('A', reads)).toBe('A')
  })

  test('enough N bases push the call to N (4A + 6N)', () => {
    // A=38 (32 ref-match + 6 from N dilution), C=G=T=6 each, tscore=56. Each
    // of C/G/T (6) is below het-fract's need (0.5*38=19), so none folds in —
    // this isn't a real 2nd allele, just diluted noise. A alone (38) then
    // fails call-fract's need (0.75*56=42) -> N. Unlike the 60/40 case above,
    // there's no runner-up substantial enough to promote to an IUPAC code;
    // the noise is just left unexplained, which is exactly what call-fract
    // guards against.
    const reads = [
      ...times(4, { start: 0, end: 1 }),
      ...times(6, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'N' }] }),
    ]
    expect(runAmbig('A', reads)).toBe('N')
  })
})
