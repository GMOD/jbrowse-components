import { forEachMismatchNumeric } from '@gmod/bam'
import {
  clipLengthAtStartOfReadNumeric,
  encodeSeqNumeric,
  parseCigar2Typed,
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_REVERSE,
  SAM_FLAG_UNMAPPED,
} from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'

import type { MismatchFeature } from '../shared/extractCigarFeatures.ts'
import type { SamRecordData } from './parseSam.ts'
import type { PackedReference } from '@gmod/bam'
import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

// ASCII codes of an MD tag, the form forEachMismatchNumeric walks (it tests
// digits and letters by code point).
function encodeMd(md: string) {
  const out = new Uint8Array(md.length)
  for (let i = 0; i < md.length; i++) {
    out[i] = md.charCodeAt(i)
  }
  return out
}

// The packed forms of one record, memoized on a holder shared by every region
// view of it (see `withRegionRef`) rather than on the feature object — a view is
// a second object over the same record, and memoizing per-object would re-parse
// the CIGAR/SEQ/MD once per region the read appears in.
interface NumericCache {
  cigar?: Uint32Array
  seq?: Uint8Array
  md?: Uint8Array
}

/**
 * A SAM text alignment as a `Feature`, exposing the same fields and the same
 * `forEachMismatch` walk that BAM/CRAM records do — so a SAM record renders in
 * an AlignmentsTrack with per-base mismatches, indels and clipping rather than
 * as a plain block.
 *
 * The packed CIGAR/SEQ/MD arrays are built lazily and memoized: the record
 * objects live for the lifetime of the loaded file (unlike BAM's per-region
 * records), so a pan back over the same reads reuses them.
 */
export default class SamRecordFeature implements MismatchFeature {
  constructor(
    private record: SamRecordData,
    private uniqueId: string,
    // Shared with every region view of this record; the adapter's cached
    // instance creates it and `withRegionRef` passes it along.
    private numeric: NumericCache = {},
    // Region-wide packed reference this view resolves its mismatches against;
    // it carries the region's own start, which locates the read in it.
    // Immutable, and set only by `withRegionRef`: because
    // the adapter caches one record object for the file's lifetime, every
    // displayed region's fetch sees the SAME instance, so writing the fetched
    // region's reference onto it would relocate the read for every other region
    // in flight (all needed regions are fetched at once).
    public readonly ref?: PackedReference,
  ) {}

  /**
   * A per-fetch view of this record bound to one region's reference slice.
   * Shares the record and its packed-array cache, and keeps the same feature id
   * — ids must not depend on the queried region (the pileup's read lookups
   * compare them across regions).
   */
  withRegionRef(ref: PackedReference) {
    return new SamRecordFeature(this.record, this.uniqueId, this.numeric, ref)
  }

  id() {
    return this.uniqueId
  }

  get name() {
    return this.record.name
  }

  get start() {
    return this.record.start
  }

  get end() {
    return this.record.end
  }

  get refName() {
    return this.record.refName
  }

  get flags() {
    return this.record.flags
  }

  // The one sanctioned place SAM_FLAG_REVERSE becomes a strand: an adapter's
  // feature class DEFINES `strand` for a SAM-flavoured record. Everything
  // downstream reads the result via `shared/util.ts`'s getStrand — a flagless
  // source (PAF/synteny) rides the same pipeline and has no reverse bit to read.
  get strand() {
    return this.flags & SAM_FLAG_REVERSE ? -1 : 1
  }

  // BAM/CRAM spell MAPQ `score`, and getMappingQuality reads that first
  get score() {
    return this.record.mapq
  }

  get seq() {
    return this.record.seq
  }

  get seq_length() {
    return this.record.seq.length
  }

  get CIGAR() {
    return this.record.CIGAR
  }

  get tags() {
    return this.record.tags
  }

  get template_length() {
    return this.record.template_length
  }

  get next_ref() {
    return this.record.next_ref
  }

  get next_pos() {
    return this.record.next_pos
  }

  get next_segment_position() {
    const { next_ref, next_pos } = this.record
    return next_ref !== undefined && next_pos !== undefined
      ? `${next_ref}:${next_pos + 1}`
      : undefined
  }

  get qualRaw() {
    return this.record.qual
  }

  get qual() {
    return this.record.qual?.join(' ')
  }

  get NUMERIC_CIGAR() {
    this.numeric.cigar ??= parseCigar2Typed(this.record.CIGAR)
    return this.numeric.cigar
  }

  get NUMERIC_SEQ() {
    this.numeric.seq ??= encodeSeqNumeric(this.record.seq)
    return this.numeric.seq
  }

  // An MD tag makes the walk reference-free; without one the adapter supplies
  // `ref` instead.
  get NUMERIC_MD() {
    const md = this.record.tags.MD
    if (this.numeric.md === undefined && typeof md === 'string') {
      this.numeric.md = encodeMd(md)
    }
    return this.numeric.md
  }

  get clipLengthAtStartOfRead() {
    return clipLengthAtStartOfReadNumeric(this.NUMERIC_CIGAR, this.strand)
  }

  /**
   * IGV's pair-orientation string (e.g. `F1R2`), read by the pair-orientation
   * color mode. Only defined for a pair mapped to one reference, which is the
   * only case the categories describe.
   */
  get pair_orientation() {
    const { flags, next_ref, refName, template_length } = this.record
    const paired =
      flags & SAM_FLAG_PAIRED &&
      !(flags & SAM_FLAG_UNMAPPED) &&
      !(flags & SAM_FLAG_MATE_UNMAPPED) &&
      next_ref === refName
    if (!paired) {
      return undefined
    }
    const first = flags & SAM_FLAG_FIRST_IN_PAIR
    const self = `${flags & SAM_FLAG_REVERSE ? 'R' : 'F'}${first ? 1 : 2}`
    const mate = `${flags & SAM_FLAG_MATE_REVERSE ? 'R' : 'F'}${first ? 2 : 1}`
    // the leftmost segment leads, which is what TLEN's sign encodes
    return template_length > 0 ? `${self}${mate}` : `${mate}${self}`
  }

  get mismatches() {
    return collectMismatches(this)
  }

  // See BamSlightlyLazyFeature. The window is genomic and `origin` makes the
  // reported positions read-relative; the walk bounds base comparison by what
  // `ref` covers on its own, so a read overhanging the fetched span still
  // reports the indels and clips outside it.
  forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow) {
    const { ref, start } = this
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.record.qual,
      ref,
      start,
      opts?.start ?? Number.NEGATIVE_INFINITY,
      opts?.end ?? Number.POSITIVE_INFINITY,
      start,
      callback,
    )
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
      case 'seq_length':
        return this.seq_length
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
      case 'NUMERIC_SEQ':
        return this.NUMERIC_SEQ
      case 'NUMERIC_MD':
        return this.NUMERIC_MD
      case 'mismatches':
        return this.mismatches
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

  get fields(): SimpleFeatureSerialized {
    return {
      uniqueId: this.uniqueId,
      start: this.start,
      end: this.end,
      name: this.name,
      score: this.score,
      strand: this.strand,
      refName: this.refName,
      type: 'match',
      flags: this.flags,
      tags: this.tags,
      template_length: this.template_length,
      pair_orientation: this.pair_orientation,
      next_ref: this.next_ref,
      next_pos: this.next_pos,
      next_segment_position: this.next_segment_position,
    }
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.CIGAR,
      seq: this.seq,
      qual: this.qual,
    }
  }
}
