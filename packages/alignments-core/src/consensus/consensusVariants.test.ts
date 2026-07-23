import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
} from '@jbrowse/cigar-utils'

import { buildConsensusTally } from './computeConsensus.ts'
import { computeConsensusVariants, variantsToVcf } from './consensusVariants.ts'

import type { ConsensusFeature, ConsensusOptions } from './computeConsensus.ts'
import type { MismatchCallback } from '@jbrowse/cigar-utils'

interface ReadSpec {
  start: number
  end: number
  mismatches?: { pos: number; base: string }[]
  dels?: { pos: number; len: number }[]
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

function variants(
  reference: string,
  reads: ReadSpec[],
  opts: ConsensusOptions = {},
) {
  const region = { start: 0, end: reference.length }
  const tally = buildConsensusTally(reads.map(mockFeature), region)
  return computeConsensusVariants(reference, tally, opts)
}

// See computeConsensus.test.ts: hetFract opts into IUPAC ambiguity.
function variantsAmbig(reference: string, reads: ReadSpec[]) {
  return variants(reference, reads, { hetFract: 0.5 })
}

function times(count: number, r: ReadSpec) {
  return Array.from({ length: count }, () => r)
}

describe('computeConsensusVariants', () => {
  test('no variants when the consensus matches the reference', () => {
    expect(variants('ACGT', times(5, { start: 0, end: 4 }))).toEqual([])
  })

  test('emits an SNV where the majority base differs from the reference', () => {
    const reads = times(5, {
      start: 0,
      end: 4,
      mismatches: [{ pos: 1, base: 'G' }],
    })
    expect(variants('ACGT', reads)).toEqual([
      { pos: 1, ref: 'C', alt: 'G', depth: 5, af: 1, type: 'snv' },
    ])
  })

  test('coalesces a multi-base deletion into one left-anchored record', () => {
    const reads = times(5, { start: 0, end: 5, dels: [{ pos: 1, len: 2 }] })
    // ref A[CG]TA, deletion of CG -> REF=ACG ALT=A anchored at pos 0
    expect(variants('ACGTA', reads)).toEqual([
      { pos: 0, ref: 'ACG', alt: 'A', depth: 5, af: 1, type: 'del' },
    ])
  })

  test('emits a left-anchored insertion', () => {
    const reads = times(5, {
      start: 0,
      end: 3,
      ins: [{ afterPos: 0, bases: 'TT' }],
    })
    expect(variants('ACG', reads)).toEqual([
      { pos: 0, ref: 'A', alt: 'ATT', depth: 5, af: 1, type: 'ins' },
    ])
  })

  test('N (no-call) positions are not variants', () => {
    const reads = [
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'C' }] }),
    ]
    expect(variants('A', reads)).toEqual([])
  })

  test('a sub-threshold deletion is still emitted (samtools asymmetry)', () => {
    // 3 del : 2 ref at pos 1 -> gap wins but at 60% < callFract, and samtools
    // calls it anyway, so the deletion record is real and its AF is below
    // callFract. With hetFract this same column becomes a base/gap ambiguity
    // and is dropped instead (below).
    const reads = [
      ...times(3, { start: 0, end: 3, dels: [{ pos: 1, len: 1 }] }),
      ...times(2, { start: 0, end: 3 }),
    ]
    expect(variants('ACG', reads)).toEqual([
      { pos: 0, ref: 'AC', alt: 'A', depth: 5, af: 0.6, type: 'del' },
    ])
  })
})

describe('computeConsensusVariants with IUPAC ambiguity', () => {
  test('IUPAC ambiguity positions are not variants', () => {
    const reads = [
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'G' }] }),
      ...times(5, { start: 0, end: 1, mismatches: [{ pos: 0, base: 'C' }] }),
    ]
    expect(variantsAmbig('A', reads)).toEqual([])
  })

  test('base/gap ambiguity is not emitted as a hard deletion', () => {
    const reads = [
      ...times(3, {
        start: 0,
        end: 3,
        dels: [{ pos: 1, len: 1 }],
      }),
      ...times(2, { start: 0, end: 3 }),
    ]
    expect(variantsAmbig('ACG', reads)).toEqual([])
  })

  test('IUPAC insertion sequences are not emitted as VCF alleles', () => {
    const reads = [
      ...times(6, {
        start: 0,
        end: 1,
        ins: [{ afterPos: 0, bases: 'A' }],
      }),
      ...times(4, {
        start: 0,
        end: 1,
        ins: [{ afterPos: 0, bases: 'G' }],
      }),
    ]
    expect(variantsAmbig('A', reads)).toEqual([])
  })

  test('an insertion with any ambiguous column is omitted in full', () => {
    const reads = [
      ...times(6, {
        start: 0,
        end: 1,
        ins: [{ afterPos: 0, bases: 'AA' }],
      }),
      ...times(4, {
        start: 0,
        end: 1,
        ins: [{ afterPos: 0, bases: 'AG' }],
      }),
    ]
    expect(variantsAmbig('A', reads)).toEqual([])
  })

  test('base/gap ambiguous insertions are not emitted as VCF alleles', () => {
    const reads = [
      ...times(3, {
        start: 0,
        end: 1,
        ins: [{ afterPos: 0, bases: 'T' }],
      }),
      ...times(2, { start: 0, end: 1 }),
    ]
    expect(variantsAmbig('A', reads)).toEqual([])
  })
})

describe('variantsToVcf', () => {
  test('formats records as VCF with DP/AF/TYPE and 1-based POS', () => {
    const vcf = variantsToVcf([
      {
        refName: 'ctgA',
        variants: [
          { pos: 1, ref: 'C', alt: 'G', depth: 5, af: 1, type: 'snv' },
        ],
      },
    ])
    expect(vcf).toContain('##fileformat=VCFv4.3')
    expect(vcf).toContain('##contig=<ID=ctgA>')
    expect(vcf).toContain('ctgA\t2\t.\tC\tG\t.\t.\tDP=5;AF=1.000;TYPE=snv')
  })

  test('merges same-refName blocks into one sorted contig', () => {
    const vcf = variantsToVcf([
      {
        refName: 'ctgA',
        variants: [
          { pos: 20, ref: 'A', alt: 'G', depth: 5, af: 1, type: 'snv' },
        ],
      },
      {
        refName: 'ctgA',
        variants: [
          { pos: 5, ref: 'T', alt: 'C', depth: 5, af: 1, type: 'snv' },
        ],
      },
    ])
    // one contig line, records position-sorted (pos 6 before pos 21)
    expect(vcf.match(/##contig=<ID=ctgA>/g)).toHaveLength(1)
    const rows = vcf
      .trim()
      .split('\n')
      .filter(l => !l.startsWith('#'))
    expect(rows.map(r => r.split('\t')[1])).toEqual(['6', '21'])
  })
})
