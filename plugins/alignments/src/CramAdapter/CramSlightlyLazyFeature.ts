import {
  CIGAR_H,
  CIGAR_S,
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '@jbrowse/cigar-utils'

import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR.ts'
import { collectMismatches } from '../shared/collectMismatches.ts'
import { getPairOrientation } from '../shared/pairOrientation.ts'
import { cacheGetter, convertTagsToPlainArrays } from '../shared/util.ts'

import type CramAdapter from './CramAdapter.ts'
import type { CramRecord } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

// Packed CIGAR op index (packed & 0xf) to op char, indices per BAM spec:
// M=0 I=1 D=2 N=3 S=4 H=5 P=6 ==7 X=8
const CIGAR_CHARS = 'MIDNSHP=X'

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
    return (this.record.qualityScores ?? []).join(' ')
  }

  get qualRaw() {
    return this.record.qualityScores
  }

  get refName() {
    return this._store.refIdToName(this.record.sequenceId)!
  }

  get pair_orientation() {
    if (!this.record.isPaired()) {
      return undefined
    }
    const { flags, mate } = this.record
    return getPairOrientation({
      isRead1: !!(flags & 0x40),
      isSelfRev: !!(flags & 0x10),
      isMateRev: !!(flags & 0x20),
      selfRefId: this.record.sequenceId,
      selfPos: this.record.alignmentStart,
      mateRefId: mate?.sequenceId,
      matePos: mate?.alignmentStart,
    })
  }

  get template_length() {
    return this.record.templateLength ?? this.record.templateSize
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

  get next_pos() {
    if (this.record.mate) {
      return this.record.mate.alignmentStart - 1
    }
    return undefined
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

  // packed CIGAR array, each entry (length << 4) | opIndex
  get NUMERIC_CIGAR() {
    return readFeaturesToNumericCIGAR(
      this.record.readFeatures,
      this.record.alignmentStart,
      this.record.readLength,
    )
  }

  // start-clip length in read coordinates, read straight off NUMERIC_CIGAR so
  // the render path never builds/caches the full CIGAR string. Equivalent to
  // getClip(CIGAR, strand) since CIGAR is just NUMERIC_CIGAR serialized.
  get clipLengthAtStartOfRead() {
    const cigar = this.NUMERIC_CIGAR
    const len = cigar.length
    if (len === 0) {
      return 0
    }
    const packed = this.strand === -1 ? cigar[len - 1]! : cigar[0]!
    const op = packed & 0xf
    return op === CIGAR_S || op === CIGAR_H ? packed >> 4 : 0
  }

  // generate a CIGAR string from NUMERIC_CIGAR
  get CIGAR() {
    const numeric = this.NUMERIC_CIGAR
    let result = ''
    for (let i = 0, l = numeric.length; i < l; i++) {
      const packed = numeric[i]!
      result += (packed >> 4) + CIGAR_CHARS[packed & 0xf]!
    }
    return result
  }

  id() {
    return `${this._store.id}-${this.record.uniqueId}`
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(field: string): unknown
  get(field: string): unknown {
    switch (field) {
      case 'mismatches':
        return this.mismatches
      case 'name':
        return this.name
      case 'start':
        return this.start
      case 'end':
        return this.end
      case 'refName':
        return this.refName
      case 'strand':
        return this.strand
      case 'score':
        return this.score
      case 'flags':
        return this.flags
      case 'seq':
        return this.seq
      case 'tags':
        return this.tags
      case 'qual':
        return this.qual
      case 'NUMERIC_QUAL':
        return this.qualRaw
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      case 'seq_length':
        return this.record.readLength
      case 'pair_orientation':
        return this.pair_orientation
      case 'next_ref':
        return this.next_ref
      case 'next_pos':
        return this.next_pos
      case 'next_segment_position':
        return this.next_segment_position
      case 'template_length':
        return this.template_length
      case 'clipLengthAtStartOfRead':
        return this.clipLengthAtStartOfRead
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
    return collectMismatches(this)
  }

  // windowStart/windowEnd (genomic) clip emissions to the viewport, matching
  // BamSlightlyLazyFeature. refPos below is already read-relative, so the window
  // is converted to that space once.
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const readFeatures = this.record.readFeatures
    if (!readFeatures) {
      return
    }

    const featStart = this.start
    const qual = this.qualRaw
    const hasQual = !!qual
    const len = readFeatures.length
    const wLo =
      windowStart === undefined
        ? Number.NEGATIVE_INFINITY
        : windowStart - featStart
    const wHi =
      windowEnd === undefined ? Number.POSITIVE_INFINITY : windowEnd - featStart

    let refPos = 0
    let lastPos = featStart
    let insertedBases = ''
    let insertedBasesLen = 0

    for (let i = 0; i < len; i++) {
      const rf = readFeatures[i]!
      const sublen = refPos - lastPos
      lastPos = refPos

      // Flush accumulated single-base insertions
      if (sublen && insertedBasesLen > 0) {
        if (refPos >= wLo && refPos < wHi) {
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
        insertedBases = ''
        insertedBasesLen = 0
      }
      refPos = rf.refPos - 1 - featStart

      const { code } = rf
      const inWindow = refPos < wHi && refPos + 1 > wLo

      if (code === 'X') {
        if (inWindow) {
          const refCharCode = rf.ref ? rf.ref.charCodeAt(0) & ~0x20 : 0
          callback(
            MISMATCH_TYPE,
            refPos,
            1,
            rf.sub ?? 'N',
            hasQual ? qual[rf.pos - 1]! : -1,
            refCharCode,
            0,
          )
        }
      } else if (code === 'I') {
        if (inWindow) {
          callback(INSERTION_TYPE, refPos, 0, rf.data, -1, 0, rf.data.length)
        }
      } else if (code === 'N') {
        if (refPos < wHi && refPos + rf.data > wLo) {
          callback(SKIP_TYPE, refPos, rf.data, 'N', -1, 0, 0)
        }
      } else if (code === 'S') {
        if (inWindow) {
          const dataLen = rf.data.length
          callback(SOFTCLIP_TYPE, refPos, 1, `S${dataLen}`, -1, 0, dataLen)
        }
      } else if (code === 'H') {
        if (inWindow) {
          callback(HARDCLIP_TYPE, refPos, 1, `H${rf.data}`, -1, 0, rf.data)
        }
      } else if (code === 'D') {
        if (refPos < wHi && refPos + rf.data > wLo) {
          callback(DELETION_TYPE, refPos, rf.data, '*', -1, 0, 0)
        }
      } else if (code === 'i') {
        insertedBases += rf.data
        insertedBasesLen++
      }
    }

    // Flush any remaining accumulated insertions
    if (insertedBasesLen > 0 && refPos >= wLo && refPos < wHi) {
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
      CIGAR: this.CIGAR,
      seq: this.seq,
      tags: convertTagsToPlainArrays(this.tags),
      qual: this.qual,
    }
  }
}

cacheGetter(CramSlightlyLazyFeature, 'fields')
cacheGetter(CramSlightlyLazyFeature, 'CIGAR')
cacheGetter(CramSlightlyLazyFeature, 'NUMERIC_CIGAR')
