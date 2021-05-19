/* eslint-disable no-underscore-dangle */
import {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

import CramAdapter from './CramAdapter'

export interface Mismatch {
  qual?: number
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
    let seq = ''
    let cigar = ''
    let op = 'M'
    let oplen = 0

    // not sure I should access these, but...
    const ref = this.record._refRegion.seq
    const refStart = this.record._refRegion.start
    let last_pos = this.record.alignmentStart
    let sublen = 0
    if (typeof this.record.readFeatures !== 'undefined') {
      // @ts-ignore
      this.record.readFeatures.forEach(({ code, refPos, sub, data }) => {
        sublen = refPos - last_pos
        seq += ref.substring(last_pos - refStart, refPos - refStart)
        last_pos = refPos

        if (oplen && op !== 'M') {
          cigar += oplen + op
          oplen = 0
        }
        if (sublen) {
          op = 'M'
          oplen += sublen
        }

        if (code === 'b') {
          // An array of bases stored verbatim
          const ret = data.split(',')
          const added = String.fromCharCode(...ret)
          seq += added
          last_pos += added.length
          oplen += added.length
        } else if (code === 'B') {
          // Single base (+ qual score)
          seq += sub
          last_pos++
          oplen++
        } else if (code === 'X') {
          // Substitution
          seq += sub
          last_pos++
          oplen++
        } else if (code === 'D' || code === 'N') {
          // Deletion or Ref Skip
          last_pos += data
          if (oplen) {
            cigar += oplen + op
          }
          cigar += data + code
          oplen = 0
        } else if (code === 'I' || code === 'S') {
          // Insertion or soft-clip
          seq += data
          if (oplen) {
            cigar += oplen + op
          }
          cigar += data.length + code
          oplen = 0
        } else if (code === 'i') {
          // Single base insertion
          seq += data
          if (oplen) {
            cigar += oplen + op
          }
          cigar += `${1}I`
          oplen = 0
        } else if (code === 'P') {
          // Padding
          if (oplen) {
            cigar += oplen + op
          }
          cigar += `${data}P`
        } else if (code === 'H') {
          // Hard clip
          if (oplen) {
            cigar += oplen + op
          }
          cigar += `${data}H`
          oplen = 0
        } // else q or Q
      })
    } else {
      sublen = this.record.readLength - seq.length
    }
    if (seq.length !== this.record.readLength) {
      sublen = this.record.readLength - seq.length
      seq += ref.substring(last_pos - refStart, last_pos - refStart + sublen)

      if (oplen && op !== 'M') {
        cigar += oplen + op
        oplen = 0
      }
      op = 'M'
      oplen += sublen
    }
    if (oplen) {
      cigar += oplen + op
    }
    return cigar
  }

  tags() {
    const properties = Object.getOwnPropertyNames(
      CramSlightlyLazyFeature.prototype,
    )
    return properties
      .filter(
        prop =>
          prop.startsWith('_get_') &&
          prop !== '_get_mismatches' &&
          prop !== '_get_skips_and_dels' &&
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags: Record<string, any> = {}
    this.tags().forEach((t: string) => {
      const val = this.get(t)
      if (val !== undefined) {
        tags[t] = val
      }
    })

    return {
      ...tags,
      name: this.get('name'),
      type: this.get('type'),
      uniqueId: this.id(),
    }
  }

  _get_mismatches(): Mismatch[] {
    const readFeatures = this.get('cram_read_features')
    const qual = this.qualRaw()
    if (!readFeatures) {
      return []
    }
    const start = this.get('start')
    const mismatches: Mismatch[] = []
    readFeatures.forEach(
      (args: {
        code: string
        refPos: number
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any
        pos: number
        sub: string
        ref: string
      }) => {
        const { code, pos, data, sub, ref } = args
        const refPos = args.refPos - 1 - start
        if (code === 'X') {
          // substitution
          mismatches.push({
            start: refPos,
            length: 1,
            base: sub,
            qual: qual?.[pos],
            altbase: ref,
            type: 'mismatch',
          })
        } else if (code === 'I') {
          // insertion
          mismatches.push({
            start: refPos,
            type: 'insertion',
            base: `${data.length}`,
            length: 0,
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
          const len = data
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

  _get_skips_and_dels(): Mismatch[] {
    return this._get_mismatches()
  }
}
