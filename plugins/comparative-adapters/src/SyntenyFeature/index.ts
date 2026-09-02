import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  coarseCigarOwnAxis,
  forEachCsMismatch,
  getMismatches,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'
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
      return getMismatches(this.walkableCigar)
    } else if (name === 'clipLengthAtStartOfRead') {
      return this.clipLengthAtStartOfRead
    } else if (name === 'name') {
      return super.get('name') ?? this.mate?.refName
    } else {
      return super.get(name)
    }
  }

  private get mate() {
    return super.get('mate') as { refName?: string; start?: number } | undefined
  }

  // The CIGAR, or on the coarse tier its fold read along this row's own axis,
  // so a kept indel places itself where the fine tier's would; the runs' mate
  // lengths mean nothing to a reference-anchored mismatch walk.
  private get walkableCigar() {
    const cigar = super.get('CIGAR')
    const coarse = super.get('coarseCigar')
    return typeof cigar === 'string'
      ? cigar
      : typeof coarse === 'string'
        ? coarseCigarOwnAxis(coarse)
        : undefined
  }

  // The block's offset along the other sequence, i.e. what a soft clip is to a
  // read: the position the alignments chain builder sorts a name's blocks by,
  // so a contig's blocks chain in contig order rather than fetch order. A PAF
  // CIGAR carries no clip of its own.
  get clipLengthAtStartOfRead() {
    return this.mate?.start ?? 0
  }

  forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow) {
    const start = this.get('start')
    const ws = opts?.start === undefined ? undefined : opts.start - start
    const we = opts?.end === undefined ? undefined : opts.end - start
    const cs = this.get('cs') as string | undefined
    if (cs) {
      forEachCsMismatch(cs, callback, ws, we)
    } else {
      const lo = ws ?? Number.NEGATIVE_INFINITY
      const hi = we ?? Number.POSITIVE_INFINITY
      for (const m of getMismatches(this.walkableCigar)) {
        // Deletions and skips are spans, so one that starts left of the window
        // but reaches into it still draws — the overlap test the cs path and
        // BAM's forEachMismatchNumeric both apply. Clipping them on start
        // alone made a deletion larger than the viewport vanish exactly when
        // zoomed into it.
        const visible =
          m.type === 'deletion' || m.type === 'skip'
            ? m.start < hi && m.start + m.length > lo
            : m.start >= lo && m.start <= hi
        if (visible) {
          if (m.type === 'mismatch') {
            callback(
              MISMATCH_TYPE,
              m.start,
              m.length,
              m.base,
              m.qual ?? -1,
              0,
              0,
            )
          } else if (m.type === 'insertion') {
            callback(
              INSERTION_TYPE,
              m.start,
              m.length,
              m.insertedBases ?? '',
              -1,
              0,
              m.insertlen,
            )
          } else if (m.type === 'deletion') {
            callback(DELETION_TYPE, m.start, m.length, '', -1, 0, 0)
          } else if (m.type === 'skip') {
            callback(SKIP_TYPE, m.start, m.length, '', -1, 0, 0)
          }
        }
      }
    }
  }
}
