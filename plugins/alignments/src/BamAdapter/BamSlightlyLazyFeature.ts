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
          this.record.CIGAR,
          this.record.tags.MD as string | undefined,
          this.record.seq,
          this.ref,
          this.record.qualRaw,
        )
      : this.fields[field]
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  get fields() {
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
      flags: r.flags,
      tags: r.tags,
      refName: a.refIdToName(r.ref_id)!,
      CIGAR: r.CIGAR,
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

  toJSON() {
    return this.fields
  }
}

function cacheGetter<T>(ctor: { prototype: T }, prop: keyof T): void {
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop)
  if (!desc) {
    throw new Error('t1')
  }
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const getter = desc.get
  if (!getter) {
    throw new Error('t2')
  }
  Object.defineProperty(ctor.prototype, prop, {
    get() {
      const ret = getter.call(this)
      Object.defineProperty(this, prop, { value: ret })
      return ret
    },
  })
}

cacheGetter(BamSlightlyLazyFeature, 'fields')
