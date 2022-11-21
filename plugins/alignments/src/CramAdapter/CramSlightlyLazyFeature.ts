/* eslint-disable no-underscore-dangle */
import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { CramRecord } from '@gmod/cram'
import CramAdapter from './CramAdapter'
import { Mismatch, readFeaturesToCIGAR, readFeaturesToMismatches } from './util'

export default class CramSlightlyLazyFeature implements Feature {
  // uses parameter properties to automatically create fields on the class
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(private record: CramRecord, private _store: CramAdapter) {}

  _get_name() {
    return this.record.readName
  }

  _get_start() {
    return this.record.alignmentStart - 1
  }

  _get_end() {
    return this.record.alignmentStart + (this.record.lengthOnRef ?? 1) - 1
  }

  _get_cram_read_features() {
    return this.record.readFeatures
  }

  _get_type() {
    return 'match'
  }

  _get_score() {
    return this.record.mappingQuality
  }

  _get_flags() {
    return this.record.flags
  }

  _get_strand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _read_group_id() {
    const rg = this._store.samHeader.readGroups
    return rg ? rg[this.record.readGroupId] : undefined
  }

  _get_qual() {
    return (this.record.qualityScores || []).join(' ')
  }

  qualRaw() {
    return this.record.qualityScores
  }

  _get_seq_id() {
    return this._store.refIdToName(this.record.sequenceId)
  }

  _get_refName() {
    return this._get_seq_id()
  }

  _get_is_paired() {
    return !!this.record.mate
  }

  _get_pair_orientation() {
    return this.record.isPaired() ? this.record.getPairOrientation() : undefined
  }

  _get_template_length() {
    return this.record.templateLength || this.record.templateSize
  }

  _get_next_seq_id() {
    return this.record.mate
      ? this._store.refIdToName(this.record.mate.sequenceId)
      : undefined
  }

  _get_next_pos() {
    return this.record.mate ? this.record.mate.alignmentStart : undefined
  }

  _get_next_segment_position() {
    return this.record.mate
      ? `${this._store.refIdToName(this.record.mate.sequenceId)}:${
          this.record.mate.alignmentStart
        }`
      : undefined
  }

  _get_tags() {
    const RG = this._read_group_id()
    const { tags } = this.record
    // avoids a tag copy if no RG, but just copy if there is one
    return RG !== undefined ? { ...tags, RG } : tags
  }

  _get_seq() {
    return this.record.getReadBases()
  }

  // generate a CIGAR, based on code from jkbonfield
  _get_CIGAR() {
    return readFeaturesToCIGAR(
      this.record.readFeatures,
      this.record.alignmentStart,
      this.record.readLength,
      this.record._refRegion,
    )
  }

  tags() {
    return Object.getOwnPropertyNames(CramSlightlyLazyFeature.prototype)
      .filter(
        prop =>
          prop.startsWith('_get_') &&
          prop !== '_get_mismatches' &&
          prop !== '_get_cram_read_features',
      )
      .map(methodName => methodName.replace('_get_', ''))
  }

  id() {
    return `${this._store.id}-${this.record.uniqueId}`
  }

  get(field: string) {
    const methodName = `_get_${field}`
    // @ts-ignore
    if (this[methodName]) {
      // @ts-ignore
      return this[methodName]()
    }
    return undefined
  }

  parent(): undefined | Feature {
    return undefined
  }

  children(): undefined | Feature[] {
    return undefined
  }

  set(): void {}

  pairedFeature() {
    return false
  }

  _get_clipPos() {
    const mismatches = this.get('mismatches')
    if (mismatches.length) {
      const record =
        this.get('strand') === -1
          ? mismatches[mismatches.length - 1]
          : mismatches[0]
      const { type, cliplen } = record
      if (type === 'softclip' || type === 'hardclip') {
        return cliplen
      }
    }
    return 0
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...Object.fromEntries(
        this.tags()
          .map(t => [t, this.get(t)])
          .filter(elt => elt[1] !== undefined),
      ),
      uniqueId: this.id(),
    }
  }

  _get_mismatches(): Mismatch[] {
    const readFeatures = this.record.readFeatures
    const qual = this.qualRaw()
    const start = this.get('start')
    return readFeaturesToMismatches(readFeatures, start, qual)
  }
}
