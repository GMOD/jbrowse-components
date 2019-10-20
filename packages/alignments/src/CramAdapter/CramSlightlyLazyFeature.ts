/* eslint-disable @typescript-eslint/camelcase,no-underscore-dangle */
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import CramAdapter from './CramAdapter'

export interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

export default class CramSlightlyLazyFeature implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private record: any

  private _store: CramAdapter

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(record: any, store: CramAdapter) {
    this.record = record
    this._store = store
  }

  _get_id() {
    return this.id()
  }

  _get_name() {
    return this.record.readName
  }

  _get_start() {
    return this.record.alignmentStart - 1
  }

  _get_end() {
    return this.record.alignmentStart + this.record.lengthOnRef - 1
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

  _get_mapping_quality() {
    return this.record.mappingQuality
  }

  _get_flags() {
    return `0x${this.record.flags.toString(16)}`
  }

  _get_cramFlags() {
    return `0x${this.record.cramFlags.toString(16)}`
  }

  _get_strand() {
    return this.record.isReverseComplemented() ? -1 : 1
  }

  _get_read_group_id() {
    return this.record.readGroupId
  }

  _get_qual() {
    return (this.record.qualityScores || [])
      .map((q: number) => q + 33)
      .join(' ')
  }

  _get_seq_id() {
    return this._store.refIdToName(this.record.sequenceId)
  }

  _get_refname() {
    return this._get_seq_id()
  }

  _get_qc_failed() {
    return this.record.isFailedQc()
  }

  _get_secondary_alignment() {
    return this.record.isSecondary()
  }

  _get_duplicate() {
    return this.record.isDuplicate()
  }

  _get_supplementary_alignment() {
    return this.record.isSupplementary()
  }

  _get_pair_orientation() {
    return this.record.getPairOrientation()
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

  _get_is_paired() {
    return !!this.record.mate
  }

  _get_unmapped() {
    return this.record.isSegmentUnmapped()
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
    return this.record.tags
  }

  _get_seq() {
    return this.record.getReadBases()
  }

  tags() {
    const properties = Object.getOwnPropertyNames(
      CramSlightlyLazyFeature.prototype,
    )
    return properties
      .filter(prop => /^_get_/.test(prop))
      .map(methodName => methodName.replace('_get_', ''))
  }

  id() {
    return this.record.uniqueId + 1
  }

  _get(field: string) {
    const methodName = `_get_${field}`

    // @ts-ignore
    if (this[methodName]) return this[methodName]()
    return undefined
  }

  get(field: string) {
    const methodName = `_get_${field.toLowerCase()}`
    // @ts-ignore
    if (this[methodName]) return this[methodName]()
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

  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plain: Record<string, any> = {}
    this.tags().forEach((t: string) => {
      plain[t] = this.get(t)
    })
    plain.refName = this.get('refName')
    plain.name = this.get('name')
    plain.type = this.get('type')
    plain.uniqueId = this.id()
    return plain
  }

  _get_mismatches(): Mismatch[] {
    const readFeatures = this.get('cram_read_features')
    if (!readFeatures) return []
    const start = this.get('start')
    const mismatches: Mismatch[] = []
    readFeatures.forEach(
      ({
        code,
        refPos,
        data,
        sub,
        ref,
      }: {
        code: string
        refPos: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any
        sub: string
        ref: string
      }) => {
        refPos = refPos - 1 - start
        if (code === 'X') {
          // substitution
          mismatches.push({
            start: refPos,
            length: 1,
            base: sub,
            altbase: ref,
            type: 'mismatch',
          })
        } else if (code === 'I') {
          // insertion
          mismatches.push({
            start: refPos,
            type: 'insertion',
            base: `${data.length}`,
            length: data.length,
          })
        } else if (code === 'N') {
          // reference skip
          mismatches.push({
            type: 'skip',
            length: data,
            start: refPos,
            base: 'N',
          })
        } else if (code === 'S') {
          // soft clip
          const len = data.length
          mismatches.push({
            start: refPos,
            type: 'softclip',
            base: `S${len}`,
            cliplen: len,
            length: 1,
          })
        } else if (code === 'P') {
          // padding
        } else if (code === 'H') {
          // hard clip
          const len = data.length
          mismatches.push({
            start: refPos,
            type: 'hardclip',
            base: `H${len}`,
            cliplen: len,
            length: 1,
          })
        } else if (code === 'D') {
          // deletion
          mismatches.push({
            type: 'deletion',
            length: data,
            start: refPos,
            base: '*',
          })
        } else if (code === 'b') {
          // stretch of bases
        } else if (code === 'q') {
          // stretch of qual scores
        } else if (code === 'B') {
          // a pair of [base, qual]
        } else if (code === 'i') {
          // single-base insertion
          // insertion
          mismatches.push({
            start: refPos,
            type: 'insertion',
            base: data,
            length: 1,
          })
        } else if (code === 'Q') {
          // single quality value
        }
      },
    )
    return mismatches
  }
}
