import { BamRecord } from '@gmod/bam'

import { forEachMismatchNumeric } from './forEachMismatchNumeric'
import { CHAR_FROM_CODE } from '../PileupRenderer/renderers/cigarUtil'
import { decodeSeq } from '../shared/decodeSeq'
import {
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_MAP,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes'
import { convertTagsToPlainArrays } from '../shared/util'

import type BamAdapter from './BamAdapter'
import type { MismatchCallback } from '../shared/forEachMismatchTypes'
import type { Mismatch } from '../shared/types'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

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
        const typeStr = MISMATCH_MAP[type]!
        const mismatch: Mismatch = {
          start,
          length,
          type: typeStr,
          base,
        }
        if (qual !== undefined && qual >= 0) {
          mismatch.qual = qual
        }
        if (altbase !== undefined && altbase > 0) {
          mismatch.altbase = CHAR_FROM_CODE[altbase]
        }
        if (type === INSERTION_TYPE) {
          mismatch.insertedBases = base
          mismatch.base = `${cliplen}`
        }
        if (type === SOFTCLIP_TYPE || type === HARDCLIP_TYPE) {
          mismatch.cliplen = cliplen
        }
        mismatches.push(mismatch)
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
    const q = this.qual
    if (!q) {
      return undefined
    }
    let result = ''
    for (let i = 0; i < q.length; i++) {
      result += String.fromCharCode(q[i]! + 33)
    }
    return result
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
        return this.adapter.refIdToName(this.ref_id)!
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
      const p = this.isPaired()
      this._cachedFields = {
        start: this.start,
        name: this.name,
        end: this.end,
        score: this.score,
        strand: this.strand,
        template_length: this.template_length,
        flags: this.flags,
        tags: convertTagsToPlainArrays(this.tags),
        refName: this.adapter.refIdToName(this.ref_id)!,
        type: 'match',
        pair_orientation: this.pair_orientation,
        next_ref: p ? this.adapter.refIdToName(this.next_refid) : undefined,
        next_pos: p ? this.next_pos : undefined,
        next_segment_position: p
          ? `${this.adapter.refIdToName(this.next_refid)}:${this.next_pos + 1}`
          : undefined,
        uniqueId: this.id(),
      }
    }
    return this._cachedFields
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.CIGAR,
      seq: this.seq,
      qual: this.qualString,
    }
  }
}
