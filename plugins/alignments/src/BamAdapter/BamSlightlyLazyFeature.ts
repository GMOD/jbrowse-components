import { BamRecord } from '@gmod/bam'

import { getMismatchesFromNumericMD } from './getMismatchesNumeric'
import { decodeSeq } from '../shared/decodeSeq'

import type BamAdapter from './BamAdapter'
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
  private _mismatches?: Mismatch[]
  private _fields?: SimpleFeatureSerialized

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  get seq() {
    return decodeSeq(this.NUMERIC_SEQ, this.seq_length)
  }

  get mismatches() {
    if (this._mismatches === undefined) {
      this._mismatches = getMismatchesFromNumericMD(
        this.NUMERIC_CIGAR,
        this.NUMERIC_SEQ,
        this.seq_length,
        this.NUMERIC_MD,
        this.ref,
        this.qual,
      )
    }
    return this._mismatches
  }

  get qualString() {
    return this.qual?.join(' ')
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
      case 'NUMERIC_SEQ':
        return this.NUMERIC_SEQ
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_QUAL':
        return this.qual

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
    if (this._fields === undefined) {
      const p = this.isPaired()
      this._fields = {
        start: this.start,
        name: this.name,
        end: this.end,
        score: this.score,
        strand: this.strand,
        template_length: this.template_length,
        flags: this.flags,
        tags: this.tags,
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
    return this._fields
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
