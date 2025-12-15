import { BamRecord } from '@gmod/bam'

import { getMismatchesFromNumericMD } from './getMismatchesNumeric'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  SEQRET,
} from '../PileupRenderer/renderers/cigarUtil'
import { decodeSeq } from '../shared/decodeSeq'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from '../shared/forEachMismatchTypes'

import type BamAdapter from './BamAdapter'
import type { MismatchCallback } from '../shared/forEachMismatchTypes'
import type { Mismatch } from '../shared/types'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'

export default class BamSlightlyLazyFeature
  extends BamRecord
  implements Feature
{
  public adapter!: BamAdapter
  public ref?: string
  private _mismatches?: Mismatch[]
  private _fields?: SimpleFeatureSerialized

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  get seq() {
    return decodeSeq(this.NUMERIC_SEQ, this.seq_length)
  }

  get mismatches() {
    if (this._mismatches === undefined) {
      this._mismatches = getMismatchesFromNumericMD(
        this.NUMERIC_CIGAR,
        this.NUMERIC_SEQ,
        this.seq_length,
        this.NUMERIC_MD,
        this.ref,
        this.qual,
      )
    }
    return this._mismatches
  }

  forEachMismatch(callback: MismatchCallback) {
    const cigar = this.NUMERIC_CIGAR
    const numericSeq = this.NUMERIC_SEQ
    const seqLength = this.seq_length
    const md = this.NUMERIC_MD
    const qual = this.qual

    const mdLength = md?.length ?? 0
    const hasQual = !!qual
    const hasMD = md && mdLength > 0

    let roffset = 0
    let soffset = 0
    let mdIdx = 0
    let mdMatchRemaining = 0

    if (hasMD) {
      while (mdIdx < mdLength) {
        const c = md[mdIdx]!
        if (c >= 48 && c <= 57) {
          mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
          mdIdx++
        } else {
          break
        }
      }
    }

    for (let i = 0, l = cigar.length; i < l; i++) {
      const packed = cigar[i]!
      const len = packed >> 4
      const op = packed & 0xf

      if (op === CIGAR_M || op === CIGAR_EQ) {
        if (hasMD) {
          let remaining = Math.min(len, seqLength - soffset)
          let localOffset = 0

          while (remaining > 0) {
            if (mdMatchRemaining >= remaining) {
              mdMatchRemaining -= remaining
              localOffset += remaining
              remaining = 0
            } else {
              localOffset += mdMatchRemaining
              remaining -= mdMatchRemaining
              mdMatchRemaining = 0

              if (mdIdx < mdLength && md[mdIdx]! >= 65 && md[mdIdx]! <= 90) {
                const seqIdx = soffset + localOffset
                const sb = numericSeq[seqIdx >> 1]!
                const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

                callback(
                  MISMATCH_TYPE,
                  roffset + localOffset,
                  1,
                  SEQRET[nibble]!,
                  hasQual ? qual[seqIdx]! : -1,
                  md[mdIdx],
                  0,
                )

                mdIdx++
                localOffset++
                remaining--
                mdMatchRemaining = 0
                while (mdIdx < mdLength) {
                  const c = md[mdIdx]!
                  if (c >= 48 && c <= 57) {
                    mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                    mdIdx++
                  } else {
                    break
                  }
                }
              } else {
                break
              }
            }
          }
        }
        soffset += len
        roffset += len
      } else if (op === CIGAR_I) {
        let insertedBases = ''
        for (let j = 0; j < len && soffset + j < seqLength; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
          insertedBases += SEQRET[nibble]!
        }
        callback(INSERTION_TYPE, roffset, 0, insertedBases, -1, 0, len)
        soffset += len
      } else if (op === CIGAR_D) {
        callback(DELETION_TYPE, roffset, len, '*', -1, 0, 0)

        // eslint-disable-next-line @typescript-eslint/no-confusing-non-null-assertion
        if (hasMD && mdIdx < mdLength && md[mdIdx]! === 94) {
          mdIdx++
          while (mdIdx < mdLength && md[mdIdx]! >= 65) {
            mdIdx++
          }
          mdMatchRemaining = 0
          while (mdIdx < mdLength) {
            const c = md[mdIdx]!
            if (c >= 48 && c <= 57) {
              mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
              mdIdx++
            } else {
              break
            }
          }
        }
        roffset += len
      } else if (op === CIGAR_N) {
        callback(SKIP_TYPE, roffset, len, 'N', -1, 0, 0)
        roffset += len
      } else if (op === CIGAR_X) {
        for (let j = 0; j < len; j++) {
          const seqIdx = soffset + j
          const sb = numericSeq[seqIdx >> 1]!
          const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

          let altbaseCode = 0
          if (hasMD) {
            if (
              mdMatchRemaining === 0 &&
              mdIdx < mdLength &&
              md[mdIdx]! >= 65
            ) {
              altbaseCode = md[mdIdx]!
              mdIdx++
              mdMatchRemaining = 0
              while (mdIdx < mdLength) {
                const c = md[mdIdx]!
                if (c >= 48 && c <= 57) {
                  mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                  mdIdx++
                } else {
                  break
                }
              }
            } else if (mdMatchRemaining > 0) {
              mdMatchRemaining--
            }
          }

          callback(
            MISMATCH_TYPE,
            roffset + j,
            1,
            SEQRET[nibble]!,
            hasQual ? qual[seqIdx]! : -1,
            altbaseCode,
            0,
          )
        }
        soffset += len
        roffset += len
      } else if (op === CIGAR_S) {
        callback(SOFTCLIP_TYPE, roffset, 1, `S${len}`, -1, 0, len)
        soffset += len
      } else if (op === CIGAR_H) {
        callback(HARDCLIP_TYPE, roffset, 1, `H${len}`, -1, 0, len)
      }
    }
  }

  get qualString() {
    return this.qual?.join(' ')
  }

  get(field: string): any {
    switch (field) {
      case 'mismatches':
        return this.mismatches
      case 'name':
        return this.name
      case 'start':
        return this.start
      case 'refName':
        return this.adapter.refIdToName(this.ref_id)!
      case 'end':
        return this.end
      case 'strand':
        return this.strand
      case 'qual':
        return this.qualString
      case 'seq':
        return this.seq
      case 'tags':
        return this.tags
      case 'NUMERIC_SEQ':
        return this.NUMERIC_SEQ
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_QUAL':
        return this.qual
      case 'NUMERIC_MD':
        return this.NUMERIC_MD
      case 'seq_length':
        return this.seq_length

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

  get fields(): SimpleFeatureSerialized {
    if (this._fields === undefined) {
      const p = this.isPaired()
      this._fields = {
        start: this.start,
        name: this.name,
        end: this.end,
        score: this.score,
        strand: this.strand,
        template_length: this.template_length,
        flags: this.flags,
        tags: this.tags,
        refName: this.adapter.refIdToName(this.ref_id)!,
        type: 'match',
        pair_orientation: this.pair_orientation,
        next_ref: p ? this.adapter.refIdToName(this.next_refid) : undefined,
        next_pos: p ? this.next_pos : undefined,
        next_segment_position: p
          ? `${this.adapter.refIdToName(this.next_refid)}:${this.next_pos + 1}`
          : undefined,
        uniqueId: this.id(),
      }
    }
    return this._fields
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.CIGAR,
      seq: this.seq,
      qual: this.qualString,
    }
  }
}
