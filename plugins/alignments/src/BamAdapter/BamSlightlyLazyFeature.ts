import { BamRecord } from '@gmod/bam'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_REVERSE,
} from '@jbrowse/alignments-core'
import {
  clipLengthAtStartOfReadNumeric,
  forEachMismatchNumeric,
} from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { decodeSeq } from '../shared/decodeSeq.ts'
import { getPairOrientation } from '../shared/pairOrientation.ts'
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
  private _cachedFields?: SimpleFeatureSerialized

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  get seq() {
    return decodeSeq(this.NUMERIC_SEQ, this.seq_length)
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
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.qual,
      this.ref,
      callback,
      this.refOffset,
      windowStart === undefined ? undefined : windowStart - this.start,
      windowEnd === undefined ? undefined : windowEnd - this.start,
    )
  }

  get qualString() {
    return this.qual?.join(' ')
  }

  get clipLengthAtStartOfRead() {
    return clipLengthAtStartOfReadNumeric(this.NUMERIC_CIGAR, this.strand)
  }

  get pair_orientation() {
    if (!this.isPaired()) {
      return undefined
    }
    return getPairOrientation({
      isRead1: !!(this.flags & SAM_FLAG_FIRST_IN_PAIR),
      isSelfRev: !!(this.flags & SAM_FLAG_REVERSE),
      isMateRev: !!(this.flags & SAM_FLAG_MATE_REVERSE),
      selfRefId: this.ref_id,
      selfPos: this.start,
      mateRefId: this.next_refid,
      matePos: this.next_pos,
    })
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

  get fields(): SimpleFeatureSerialized {
    this._cachedFields ??= {
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
    return this._cachedFields
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
