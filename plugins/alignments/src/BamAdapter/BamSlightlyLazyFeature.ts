import { getMismatches } from '../MismatchParser'
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
  get mismatches() {
    return getMismatches(
      this.record,
      this.record.CIGAR,
      this.record.tags.MD as string | undefined,
      this.ref,
      this.record.qual,
    )
  }

  get qual() {
    return this.record.qual?.join(' ')
  }

  get tags() {
    return this.record.tags
  }

  get seq() {
    return this.record.seq
  }

  get(field: string): any {
    return field === 'mismatches'
      ? this.mismatches
      : field === 'qual'
        ? this.qual
        : field === 'tags'
          ? this.tags
          : field === 'start'
            ? this.record.start
            : field === 'end'
              ? this.record.end
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
      refName: a.refIdToName(r.ref_id)!,
      CIGAR: r.CIGAR,
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
    const len = this.record.end - this.record.start
    return {
      ...this.fields,
      tags: this.tags,
      qual: len > 10_000_000 ? 'too long' : this.qual,
      seq: len > 10_000_000 ? 'too long' : this.seq,
    }
  }
}

cacheGetter(BamSlightlyLazyFeature, 'fields')
cacheGetter(BamSlightlyLazyFeature, 'mismatches')
