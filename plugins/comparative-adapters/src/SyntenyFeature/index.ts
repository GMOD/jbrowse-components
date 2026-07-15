import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  getMismatches,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { forEachCsMismatch } from '../csUtils.ts'

import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature } from '@jbrowse/core/util'

// Implementing forEachMismatch lets synteny features flow through the alignments
// GPU/Canvas2D mismatch pipeline (LGVSyntenyDisplay reuses it), rendering
// per-base SNPs and indels. Prefer the cs tag (real query bases); fall back to
// the CIGAR (positions only, no base identity for X ops).
export default class SyntenyFeature extends SimpleFeature {
  get(name: 'mismatches'): ReturnType<typeof getMismatches>
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end' | 'clipLengthAtStartOfRead'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    if (name === 'mismatches') {
      return getMismatches(this.get('CIGAR') as string | undefined)
    } else if (name === 'clipLengthAtStartOfRead') {
      // PAF/synteny CIGARs never carry soft/hard clips
      return 0
    } else {
      return super.get(name)
    }
  }

  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const start = this.get('start')
    const ws = windowStart === undefined ? undefined : windowStart - start
    const we = windowEnd === undefined ? undefined : windowEnd - start
    const cs = this.get('cs') as string | undefined
    if (cs) {
      forEachCsMismatch(cs, callback, ws, we)
    } else {
      const lo = ws ?? Number.NEGATIVE_INFINITY
      const hi = we ?? Number.POSITIVE_INFINITY
      for (const m of getMismatches(this.get('CIGAR') as string | undefined)) {
        if (m.start >= lo && m.start <= hi) {
          if (m.type === 'mismatch') {
            callback(
              MISMATCH_TYPE,
              m.start,
              m.length,
              m.base,
              m.qual,
              undefined,
              undefined,
            )
          } else if (m.type === 'insertion') {
            callback(
              INSERTION_TYPE,
              m.start,
              m.length,
              m.insertedBases ?? '',
              undefined,
              undefined,
              m.insertlen,
            )
          } else if (m.type === 'deletion') {
            callback(
              DELETION_TYPE,
              m.start,
              m.length,
              '',
              undefined,
              undefined,
              undefined,
            )
          } else if (m.type === 'skip') {
            callback(
              SKIP_TYPE,
              m.start,
              m.length,
              '',
              undefined,
              undefined,
              undefined,
            )
          }
        }
      }
    }
  }
}
