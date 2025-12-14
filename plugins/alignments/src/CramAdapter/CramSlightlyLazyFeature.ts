import { CODE_D, CODE_H, CODE_I, CODE_N, CODE_S, CODE_X, CODE_i } from './const'
import { readFeaturesToMismatches } from './readFeaturesToMismatches'
import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes'
import { cacheGetter } from '../shared/util'

import type CramAdapter from './CramAdapter'
import type { MismatchCallback } from '../shared/forEachMismatchTypes'
import type { CramRecord } from '@gmod/cram'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

export default class CramSlightlyLazyFeature implements Feature {
  private record: CramRecord
  private _store: CramAdapter
  // uses parameter properties to automatically create fields on the class
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(record: CramRecord, _store: CramAdapter) {
    this.record = record
    this._store = _store
  }

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
    const RG = this._store.samHeader?.readGroups[this.record.readGroupId]
    return RG !== undefined ? { ...this.record.tags, RG } : this.record.tags
  }

  get seq() {
    // CRAM stores sequences as strings, not packed like BAM
    // So we return the string directly without encoding/decoding
    return this.record.getReadBases()
  }

  // generate packed NUMERIC_CIGAR as Uint32Array
  get NUMERIC_CIGAR() {
    return readFeaturesToNumericCIGAR(
      this.record.readFeatures,
      this.record.alignmentStart,
      this.record.readLength,
    )
  }

  // generate a CIGAR string from NUMERIC_CIGAR
  get CIGAR() {
    const NUMERIC_CIGAR_CODES = [
      77, 73, 68, 78, 83, 72, 80, 61, 88, 63, 63, 63, 63, 63, 63, 63,
    ]
    const numeric = this.NUMERIC_CIGAR
    let result = ''
    for (let i = 0, l = numeric.length; i < l; i++) {
      const packed = numeric[i]!
      const length = packed >> 4
      const opCode = NUMERIC_CIGAR_CODES[packed & 0xf]!
      result += length + String.fromCharCode(opCode)
    }
    return result
  }

  id() {
    return `${this._store.id}-${this.record.uniqueId}`
  }

  get(field: string): any {
    switch (field) {
      case 'mismatches':
        return this.mismatches
      case 'qual':
        return this.qual
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      default:
        return this.fields[field]
    }
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

  forEachMismatch(callback: MismatchCallback) {
    const readFeatures = this.record.readFeatures
    if (!readFeatures) {
      return
    }

    const featStart = this.start
    const qual = this.qualRaw
    const len = readFeatures.length

    let refPos = 0
    let lastPos = featStart
    let insertedBases = ''
    let insertedBasesLen = 0

    for (let i = 0; i < len; i++) {
      const rf = readFeatures[i]!
      const { refPos: p, code, pos, data, sub, ref } = rf
      const sublen = refPos - lastPos
      lastPos = refPos

      // Flush accumulated single-base insertions
      if (sublen && insertedBasesLen > 0) {
        callback(
          INSERTION_TYPE,
          refPos,
          0,
          insertedBases,
          -1,
          0,
          insertedBasesLen,
        )
        insertedBases = ''
        insertedBasesLen = 0
      }
      refPos = p - 1 - featStart

      const codeChar = code.charCodeAt(0)

      if (codeChar === CODE_X) {
        // substitution/mismatch
        callback(
          MISMATCH_TYPE,
          refPos,
          1,
          sub!,
          qual?.[pos - 1] ?? -1,
          ref?.toUpperCase().charCodeAt(0) ?? 0,
          0,
        )
      } else if (codeChar === CODE_I) {
        // insertion
        callback(INSERTION_TYPE, refPos, 0, data, -1, 0, data.length)
      } else if (codeChar === CODE_N) {
        // reference skip
        callback(SKIP_TYPE, refPos, data, 'N', -1, 0, 0)
      } else if (codeChar === CODE_S) {
        // soft clip
        const dataLen = data.length
        callback(SOFTCLIP_TYPE, refPos, 1, `S${dataLen}`, -1, 0, dataLen)
      } else if (codeChar === CODE_H) {
        // hard clip
        callback(HARDCLIP_TYPE, refPos, 1, `H${data}`, -1, 0, data)
      } else if (codeChar === CODE_D) {
        // deletion
        callback(DELETION_TYPE, refPos, data, '*', -1, 0, 0)
      } else if (codeChar === CODE_i) {
        // single-base insertion - accumulate
        insertedBases += data
        insertedBasesLen++
      }
    }

    // Flush any remaining accumulated insertions
    if (insertedBasesLen > 0) {
      callback(
        INSERTION_TYPE,
        refPos,
        0,
        insertedBases,
        -1,
        0,
        insertedBasesLen,
      )
    }
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
cacheGetter(CramSlightlyLazyFeature, 'NUMERIC_CIGAR')
cacheGetter(CramSlightlyLazyFeature, 'mismatches')
