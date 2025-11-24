import { getMismatchesNumeric } from './getMismatchesNumeric'
import { decodeSeq } from '../shared/decodeSeq'
import { cacheGetter } from '../shared/util'

import type BamAdapter from './BamAdapter'
import type { BamRecord } from '@gmod/bam'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

export default class BamSlightlyLazyFeature implements Feature {
  // uses parameter properties to automatically create fields on the class
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(
    private record: BamRecord,
    private adapter: BamAdapter,
    private ref?: string,
  ) {}

  id() {
    return `${this.adapter.id}-${this.record.id}`
  }

  get seq() {
    // Decode NUMERIC_SEQ on demand
    const numericSeq = this.record.NUMERIC_SEQ
    return decodeSeq(numericSeq, this.record.seq_length)
  }

  get mismatches() {
    // Use optimized version that works directly on NUMERIC_SEQ
    // without decoding the entire sequence string
    return getMismatchesNumeric(
      this.record.NUMERIC_CIGAR,
      this.record.NUMERIC_SEQ,
      this.record.seq_length,
      this.record.tags.MD as string | undefined,
      this.ref,
      this.record.qual,
    )
  }

  get qual() {
    return this.record.qual?.join(' ')
  }

  get(field: string): any {
    return field === 'mismatches'
      ? this.mismatches
      : field === 'qual'
        ? this.qual
        : field === 'seq'
          ? this.seq
          : field === 'NUMERIC_SEQ'
            ? this.record.NUMERIC_SEQ
            : this.fields[field]
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
      CIGAR: r.CIGAR,
      // seq is decoded on-demand, not stored in fields
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
      qual: this.qual,
    }
  }
}

cacheGetter(BamSlightlyLazyFeature, 'fields')
cacheGetter(BamSlightlyLazyFeature, 'seq')
cacheGetter(BamSlightlyLazyFeature, 'mismatches')
