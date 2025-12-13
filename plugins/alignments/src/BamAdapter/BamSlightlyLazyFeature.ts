import { getMismatchesNumeric } from './getMismatchesNumeric'
import { decodeSeq } from '../shared/decodeSeq'
import { cacheGetter } from '../shared/util'

import type BamAdapter from './BamAdapter'
import type { MismatchesSOA } from '../shared/MismatchesSOA'
import type { BamRecord } from '@gmod/bam'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

export default class BamSlightlyLazyFeature implements Feature {
  private record: BamRecord
  private adapter: BamAdapter
  private ref?: string
  constructor(record: BamRecord, adapter: BamAdapter, ref?: string) {
    this.record = record
    this.adapter = adapter
    this.ref = ref
  }

  id() {
    return `${this.adapter.id}-${this.record.id}`
  }

  get seq() {
    return decodeSeq(this.record.NUMERIC_SEQ, this.record.seq_length)
  }

  get NUMERIC_MISMATCHES(): MismatchesSOA {
    return getMismatchesNumeric(
      this.record.NUMERIC_CIGAR,
      this.record.NUMERIC_SEQ,
      this.record.seq_length,
      this.record.NUMERIC_MD,
      this.ref,
      this.record.qual,
    )
  }

  get qual() {
    return this.record.qual?.join(' ')
  }

  get(field: string): any {
    switch (field) {
      case 'NUMERIC_MISMATCHES':
        return this.NUMERIC_MISMATCHES
      case 'mismatches':
        return undefined
      case 'name':
        return this.record.name
      case 'start':
        return this.record.start
      case 'end':
        return this.record.end
      case 'strand':
        return this.record.strand
      case 'qual':
        return this.qual
      case 'seq':
        return this.seq
      case 'NUMERIC_SEQ':
        return this.record.NUMERIC_SEQ
      case 'NUMERIC_CIGAR':
        return this.record.NUMERIC_CIGAR
      case 'CIGAR':
        return this.record.CIGAR
      case 'NUMERIC_QUAL':
        return this.record.qual

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
    const r = this.record
    const a = this.adapter
    const p = r.isPaired()
    return {
      start: r.start,
      name: r.name,
      end: r.end,
      score: r.score,
      strand: r.strand,
      template_length: r.template_length,
      flags: r.flags,
      tags: r.tags,
      refName: a.refIdToName(r.ref_id)!,
      type: 'match',
      pair_orientation: r.pair_orientation,
      next_ref: p ? a.refIdToName(r.next_refid) : undefined,
      next_pos: p ? r.next_pos : undefined,
      next_segment_position: p
        ? `${a.refIdToName(r.next_refid)}:${r.next_pos + 1}`
        : undefined,
      uniqueId: this.id(),
    }
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.record.CIGAR,
      seq: this.seq,
      qual: this.qual,
    }
  }
}

cacheGetter(BamSlightlyLazyFeature, 'fields')
cacheGetter(BamSlightlyLazyFeature, 'NUMERIC_MISMATCHES')
