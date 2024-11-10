import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { CramRecord } from '@gmod/cram'

// locals
import CramAdapter from './CramAdapter'
import { readFeaturesToCIGAR, readFeaturesToMismatches } from './util'

export default class CramSlightlyLazyFeature implements Feature {
  // uses parameter properties to automatically create fields on the class
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(
    private record: CramRecord,
    private _store: CramAdapter,
  ) {}

  get name() {
    return this.record.readName
  }

  get start() {
    return this.record.alignmentStart - 1
  }

  get end() {
    return this.start + (this.record.lengthOnRef ?? 1)
  }

  get type() {
    return 'match'
  }

  get score() {
    return this.record.mappingQuality
  }

  get flags() {
    return this.record.flags
  }

  get strand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  get qual() {
    return (this.record.qualityScores || []).join(' ')
  }

  get qualRaw() {
    return this.record.qualityScores
  }

  get refName() {
    return this._store.refIdToName(this.record.sequenceId)!
  }

  get pair_orientation() {
    return this.record.isPaired() ? this.record.getPairOrientation() : undefined
  }

  get template_length() {
    return this.record.templateLength || this.record.templateSize
  }

  get next_ref() {
    return this.record.mate
      ? this._store.refIdToName(this.record.mate.sequenceId)
      : undefined
  }

  get next_segment_position() {
    return this.record.mate
      ? `${this._store.refIdToName(this.record.mate.sequenceId)}:${
          this.record.mate.alignmentStart
        }`
      : undefined
  }

  get is_paired() {
    return !!this.record.mate
  }

  get next_pos() {
    return this.record.mate?.alignmentStart
  }

  get tags() {
    const RG = this._store.samHeader.readGroups?.[this.record.readGroupId]
    return RG !== undefined ? { ...this.record.tags, RG } : this.record.tags
  }

  get seq() {
    return this.record.getReadBases()
  }

  // generate a CIGAR, based on code from jkbonfield
  get CIGAR() {
    return readFeaturesToCIGAR(
      this.record.readFeatures,
      this.record.alignmentStart,
      this.record.readLength,
      this.record._refRegion,
    )
  }

  id() {
    return `${this._store.id}-${this.record.uniqueId}`
  }

  get(field: string): any {
    return field === 'mismatches' ? this.mismatches : this.fields[field]
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  get mismatches() {
    return readFeaturesToMismatches(
      this.record.readFeatures,
      this.start,
      this.qualRaw,
    )
  }

  get fields(): SimpleFeatureSerialized {
    return {
      start: this.start,
      name: this.name,
      end: this.end,
      score: this.score,
      qual: this.qual,
      strand: this.strand,
      template_length: this.template_length,
      flags: this.flags,
      tags: this.tags,
      refName: this.refName,
      CIGAR: this.CIGAR,
      seq: this.seq,
      type: 'match',
      pair_orientation: this.pair_orientation,
      next_ref: this.next_ref,
      next_pos: this.next_pos,
      next_segment_position: this.next_segment_position,
      uniqueId: this.id(),
    }
  }

  toJSON(): SimpleFeatureSerialized {
    return this.fields
  }
}

function cacheGetter<T>(ctor: { prototype: T }, prop: keyof T): void {
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop)
  if (!desc) {
    throw new Error('t1')
  }

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
cacheGetter(CramSlightlyLazyFeature, 'fields')
