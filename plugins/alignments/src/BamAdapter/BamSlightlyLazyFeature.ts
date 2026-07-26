import { BamRecord } from '@gmod/bam'
import {
  clipLengthAtStartOfReadNumeric,
  forEachMismatchNumeric,
} from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { convertTagsToPlainArrays } from '../shared/util.ts'

import type BamAdapter from './BamAdapter.ts'
import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

export default class BamSlightlyLazyFeature
  extends BamRecord
  implements Feature
{
  public adapter!: BamAdapter
  // shared region-wide reference string (covers many reads); refOffset locates
  // this read's start within it, so no per-read substring is allocated
  public ref?: string
  public refOffset = 0

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  // performance profiling showed that using forEachMismatch rather than
  // computing mismatches array up front was faster, so this is no longer the
  // primary way mismatches are used
  get mismatches() {
    return collectMismatches(this)
  }

  // windowStart/windowEnd are genomic reference coords of the viewport; the
  // walk skips CIGAR ops outside them so a chromosome-spanning contig only
  // processes its visible slice. Converted to read-relative roffset here.
  //
  // With no window, the walk still can't run past what `ref` covers: the shared
  // region string spans only [-refOffset, ref.length - refOffset) in this read's
  // reference-relative space, and a read overhanging the fetched region has no
  // reference bases for its overhang — comparing against an out-of-range
  // charCodeAt (NaN) would report every one of those bases as a mismatch. Reads
  // carrying MD need no reference and walk in full.
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const { ref, refOffset, start } = this
    const refLo = ref === undefined ? undefined : -refOffset
    const refHi = ref === undefined ? undefined : ref.length - refOffset
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.qual,
      ref,
      callback,
      refOffset,
      windowStart === undefined ? refLo : windowStart - start,
      windowEnd === undefined ? refHi : windowEnd - start,
    )
  }

  get qualString() {
    return this.qual?.join(' ')
  }

  get clipLengthAtStartOfRead() {
    return clipLengthAtStartOfReadNumeric(this.NUMERIC_CIGAR, this.strand)
  }

  get refName() {
    return this.adapter.refIdToName(this.ref_id)!
  }
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(field: string): unknown
  get(field: string): unknown {
    switch (field) {
      case 'mismatches':
        return this.mismatches
      case 'name':
        return this.name
      case 'start':
        return this.start
      case 'refName':
        return this.refName
      case 'end':
        return this.end
      case 'strand':
        return this.strand
      case 'qual':
        return this.qualString
      case 'seq':
        return this.seq
      case 'tags':
        return this.tags
      case 'NUMERIC_SEQ':
        return this.NUMERIC_SEQ
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_QUAL':
        return this.qual
      case 'NUMERIC_MD':
        return this.NUMERIC_MD
      case 'seq_length':
        return this.seq_length
      case 'flags':
        return this.flags
      case 'pair_orientation':
        return this.pair_orientation
      case 'next_ref':
        return this.next_ref
      case 'next_pos':
        return this.next_pos
      case 'template_length':
        return this.template_length
      case 'clipLengthAtStartOfRead':
        return this.clipLengthAtStartOfRead
      case 'score':
        return this.score

      default:
        return this.fields[field]
    }
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  // Only reached by toJSON() and the `default` branch of get() for fields with
  // no case above — never on the render path (measured: 0 accesses per read over
  // a pacbio pileup), so it is deliberately not memoized.
  get fields(): SimpleFeatureSerialized {
    return {
      start: this.start,
      name: this.name,
      end: this.end,
      score: this.score,
      strand: this.strand,
      template_length: this.template_length,
      flags: this.flags,
      tags: this.tags,
      refName: this.refName,
      type: 'match',
      pair_orientation: this.pair_orientation,
      next_ref: this.next_ref,
      next_pos: this.next_pos,
      next_segment_position: this.next_segment_position,
      uniqueId: this.id(),
    }
  }

  get next_ref() {
    return this.isPaired()
      ? this.adapter.refIdToName(this.next_refid)
      : undefined
  }

  get next_segment_position() {
    return this.isPaired()
      ? `${this.adapter.refIdToName(this.next_refid)}:${this.next_pos + 1}`
      : undefined
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.CIGAR,
      seq: this.seq,
      tags: convertTagsToPlainArrays(this.tags),
      qual: this.qualString,
    }
  }
}
