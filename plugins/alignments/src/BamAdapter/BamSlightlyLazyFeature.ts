// locals
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
      this.record.CIGAR,
      this.record.tags.MD as string | undefined,
      this.record.seq,
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
      seq: r.seq,
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
cacheGetter(BamSlightlyLazyFeature, 'mismatches')
