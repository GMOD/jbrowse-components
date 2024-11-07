import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { BamRecord } from '@gmod/bam'

// locals
import { getClip, getMismatches } from '../MismatchParser'
import BamAdapter from './BamAdapter'

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

  get(field: string): any {
    return field === 'mismatches'
      ? getMismatches(
          this.record.cigar,
          this.record.tags.MD as string | undefined,
          this.record.seq,
          this.ref,
          this.record.qualRaw,
        )
      : this.toJSON()[field]
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  toJSON(): SimpleFeatureSerialized {
    const r = this.record
    const a = this.adapter

    return {
      id: this.id(),
      start: r.start,
      name: r.name,
      end: r.end,
      score: r.score,
      qual: r.qual,
      strand: r.strand,
      template_length: r.template_length,
      clipPos: getClip(r.cigar, r.strand),
      tags: r.tags,
      refName: a.refIdToName(r.ref_id)!,
      CIGAR: r.cigar,
      seq: r.seq,
      type: 'match',
      pair_orientation: r.pair_orientation,
      next_ref: r.isPaired() ? a.refIdToName(r.next_refid) : undefined,
      next_pos: r.isPaired() ? r.next_pos : undefined,
      next_segment_position: r.isPaired()
        ? `${a.refIdToName(r.next_refid)}:${r.next_pos + 1}`
        : undefined,
      uniqueId: this.id(),
    }
  }

  _get_clipPos() {
    const cigar = this.get('CIGAR') || ''
    return getClip(cigar, this.get('strand'))
  }
}
