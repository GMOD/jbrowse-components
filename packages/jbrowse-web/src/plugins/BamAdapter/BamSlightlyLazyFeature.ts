/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable camelcase,no-underscore-dangle */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

export default class BamSlightlyLazyFeature implements Feature {
  private record: any

  private adapter: any

  constructor(record: any, adapter: any) {
    this.record = record
    this.adapter = adapter
  }

  _get_name() {
    return this.record._get('name')
  }

  _get_start() {
    return this.record._get('start')
  }

  _get_end() {
    return this.record._get('end')
  }

  _get_type() {
    return 'match'
  }

  _get_score() {
    return this.record._get('mq')
  }

  _get_mapping_quality() {
    return this.record.mappingQuality
  }

  _get_flags() {
    return `0x${this.record.flags.toString(16)}`
  }

  _get_strand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id() {
    return this.record.readGroupId
  }

  _get_qual() {
    return this.record._get('qual')
  }

  _get_cigar() {
    return this.record._get('cigar')
  }

  _get_refname() {
    return this.adapter.refIdToName(this.record._refID)
  }

  _get_qc_failed() {
    return this.record.isFailedQc()
  }

  _get_duplicate() {
    return this.record.isDuplicate()
  }

  _get_secondary_alignment() {
    return this.record.isSecondary()
  }

  _get_supplementary_alignment() {
    return this.record.isSupplementary()
  }

  _get_multi_segment_template() {
    return this.record.isPaired()
  }

  _get_multi_segment_all_correctly_aligned() {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_all_aligned() {
    return this.record.isProperlyPaired()
  }

  _get_multi_segment_next_segment_unmapped() {
    return this.record.isMateUnmapped()
  }

  _get_multi_segment_first() {
    return this.record.isRead1()
  }

  _get_multi_segment_last() {
    return this.record.isRead2()
  }

  _get_multi_segment_next_segment_reversed() {
    return this.record.isMateReverseComplemented()
  }

  _get_unmapped() {
    return this.record.isSegmentUnmapped()
  }

  _get_next_refname() {
    return this.adapter.refIdToName(this.record._next_refid())
  }

  _get_next_segment_position() {
    return this.record.isPaired()
      ? `${this.adapter.refIdToName(
          this.record._next_refid(),
        )}:${this.record._next_pos() + 1}`
      : undefined
  }

  _get_tags() {
    return this.record._tags()
  }

  _get_seq() {
    return this.record.getReadBases()
  }

  _get_md() {
    return this.record._get('md')
  }

  set(): void {}

  tags() {
    return this._get_tags()
  }

  id() {
    return this.record.get('id')
  }

  get(field: string): any {
    const methodName = `_get_${field.toLowerCase()}`
    // @ts-ignore
    if (this[methodName]) {
      // @ts-ignore
      return this[methodName]()
    }
    return this.record.get(field)
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  pairedFeature() {
    return false
  }

  toJSON() {
    const plain: any = {}
    this.tags().forEach((t: string) => {
      plain[t] = this.get(t)
    })
    return plain
  }
}
