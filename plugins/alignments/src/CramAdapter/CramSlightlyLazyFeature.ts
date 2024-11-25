// locals
import { readFeaturesToCIGAR, readFeaturesToMismatches } from './util'
import { cacheGetter } from '../shared/util'
import type CramAdapter from './CramAdapter'
import type { CramRecord } from '@gmod/cram'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

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
    return field === 'mismatches'
      ? this.mismatches
      : field === 'qual'
        ? this.qual
        : field === 'CIGAR'
          ? this.CIGAR
          : this.fields[field]
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
    // this commented code can try to resolve MD tags, xref https://github.com/galaxyproject/tools-iuc/issues/6523#issuecomment-2462927211 but put on hold
    // return this.tags.MD && this.seq
    //   ? mismatches.concat(
    //       mdToMismatches(
    //         this.tags.MD,
    //         parseCigar(this.CIGAR),
    //         mismatches,
    //         this.seq,
    //         this.qualRaw,
    //       ),
    //     )
    //   : mismatches
  }

  get fields(): SimpleFeatureSerialized {
    return {
      start: this.start,
      name: this.name,
      end: this.end,
      score: this.score,
      strand: this.strand,
      template_length: this.template_length,
      flags: this.flags,
      tags: this.tags,
      refName: this.refName,
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
    return {
      ...this.fields,
      // lazy
      CIGAR: this.CIGAR,
      // lazy
      qual: this.qual,
    }
  }
}

cacheGetter(CramSlightlyLazyFeature, 'fields')
cacheGetter(CramSlightlyLazyFeature, 'CIGAR')
cacheGetter(CramSlightlyLazyFeature, 'mismatches')
