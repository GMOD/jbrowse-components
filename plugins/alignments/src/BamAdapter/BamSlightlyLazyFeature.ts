import { BamRecord } from '@gmod/bam'

import { forEachMismatchNumeric } from './forEachMismatchNumeric'
import {
  CHAR_FROM_CODE,
  CIGAR_H,
  CIGAR_S,
} from '../PileupRenderer/renderers/cigarUtil'
import { decodeSeq } from '../shared/decodeSeq'
import {
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes'
import { convertTagsToPlainArrays } from '../shared/util'

import type BamAdapter from './BamAdapter'
import type { MismatchCallback } from '../shared/forEachMismatchTypes'
import type { Mismatch } from '../shared/types'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

export default class BamSlightlyLazyFeature
  extends BamRecord
  implements Feature
{
  public adapter!: BamAdapter
  public ref?: string
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
    const mismatches: Mismatch[] = []
    this.forEachMismatch(
      (type, start, length, base, qual, altbase, cliplen) => {
        if (type === MISMATCH_TYPE) {
          mismatches.push({
            type: 'mismatch',
            start,
            length,
            base,
            qual: qual !== undefined && qual >= 0 ? qual : undefined,
            altbase:
              altbase !== undefined && altbase > 0
                ? CHAR_FROM_CODE[altbase]
                : undefined,
          })
        } else if (type === INSERTION_TYPE) {
          mismatches.push({
            type: 'insertion',
            start,
            length,
            insertlen: cliplen!,
            insertedBases: base,
          })
        } else if (type === SOFTCLIP_TYPE) {
          mismatches.push({
            type: 'softclip',
            start,
            length,
            cliplen: cliplen!,
          })
        } else if (type === HARDCLIP_TYPE) {
          mismatches.push({
            type: 'hardclip',
            start,
            length,
            cliplen: cliplen!,
          })
        } else {
          mismatches.push({
            type: type === 2 ? 'deletion' : 'skip',
            start,
            length,
          })
        }
      },
    )
    return mismatches
  }

  forEachMismatch(callback: MismatchCallback) {
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.qual,
      this.ref,
      callback,
    )
  }

  get qualString() {
    return this.qual?.join(' ')
  }

  get clipLengthAtStartOfRead() {
    const cigar = this.NUMERIC_CIGAR
    if (cigar.length === 0) {
      return 0
    }
    const packed = this.strand === -1 ? cigar[cigar.length - 1]! : cigar[0]!
    const op = packed & 0xf
    if (op === CIGAR_S || op === CIGAR_H) {
      return packed >> 4
    }
    return 0
  }

  get refName() {
    return this.adapter.refIdToName(this.ref_id)!
  }
  get(field: string): any {
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
    if (this._cachedFields === undefined) {
      this._cachedFields = {
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
