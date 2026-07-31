import {
  clipLengthAtStartOfReadNumeric,
  numericCigarToString,
} from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { convertTagsToPlainArrays } from '../shared/util.ts'
import { readFeaturesToMismatches } from './readFeaturesToMismatches.ts'
import { readFeaturesToNumericCIGAR } from './readFeaturesToNumericCIGAR.ts'

import type { MismatchFeature } from '../shared/extractCigarFeatures.ts'
import type CramAdapter from './CramAdapter.ts'
import type { CramRecord } from '@gmod/cram'
import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

export default class CramSlightlyLazyFeature implements MismatchFeature {
  // parameter properties auto-create the record/adapter fields
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(
    private record: CramRecord,
    private adapter: CramAdapter,
  ) {}

  private numericCigar?: ArrayLike<number>

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
    return this.record.qualityScores?.join(' ')
  }

  get qualRaw() {
    return this.record.qualityScores
  }

  get refName() {
    return this.adapter.refIdToName(this.record.sequenceId)!
  }

  get pair_orientation() {
    return this.record.getPairOrientation()
  }

  get template_length() {
    return this.record.templateLength ?? this.record.templateSize
  }

  get next_ref() {
    return this.record.mate
      ? this.adapter.refIdToName(this.record.mate.sequenceId)
      : undefined
  }

  get next_segment_position() {
    return this.record.mate
      ? `${this.adapter.refIdToName(this.record.mate.sequenceId)}:${
          this.record.mate.alignmentStart
        }`
      : undefined
  }

  get next_pos() {
    return this.record.mate ? this.record.mate.alignmentStart - 1 : undefined
  }

  // Read group lives outside the CRAM tag block, so it is spliced in to match
  // what BAM exposes. Read ~3x per read on the render path and still not
  // memoized: an in-process A/B on volvox-rg.cram (400 reads) put re-spreading
  // at 1.06ms against 1.09ms for a cached copy.
  get tags() {
    const RG = this.adapter.samHeader?.readGroups[this.record.readGroupId]
    return RG === undefined ? this.record.tags : { ...this.record.tags, RG }
  }

  get seq() {
    // CRAM stores sequences as strings, not packed like BAM
    // So we return the string directly without encoding/decoding
    return this.record.getReadBases()
  }

  // packed CIGAR array, each entry (length << 4) | opIndex.
  //
  // The one derived value here worth memoizing, and only in combination with the
  // adapter's ultra-long feature LRU: the render path builds it once per read
  // (via clipLengthAtStartOfRead), so the memo does nothing within a single
  // extraction — it pays off when the LRU hands the same wrapper back after a
  // pan (interleaved A/B on volvox-inv-pbsim, 109 reads / 37 over 5kb: 8.4ms
  // with wrappers rebuilt vs 7.3ms reused, ~13%).
  //
  // `fields`, `CIGAR` and `tags` were measured the same way and are deliberately
  // *not* memoized: `fields` and `CIGAR` are read 0 times per read on the render
  // path (only toJSON/details touch them, once), and re-spreading `tags` on each
  // of its ~3 reads per read beats installing a per-instance copy.
  get NUMERIC_CIGAR() {
    this.numericCigar ??= readFeaturesToNumericCIGAR(
      this.record.readFeatureArena,
      this.record.readFeatureStart,
      this.record.readFeatureCount,
      this.record.alignmentStart,
      this.record.readLength,
    )
    return this.numericCigar
  }

  // start-clip length off NUMERIC_CIGAR so the render path never builds the
  // full CIGAR string. Equivalent to getClip(CIGAR, strand).
  get clipLengthAtStartOfRead() {
    return clipLengthAtStartOfReadNumeric(this.NUMERIC_CIGAR, this.strand)
  }

  get CIGAR() {
    return numericCigarToString(this.NUMERIC_CIGAR)
  }

  id() {
    return `${this.adapter.id}-${this.record.uniqueId}`
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
  // BamSlightlyLazyFeature. The readFeatures walk works in read-relative space,
  // so the window is converted to that space once before delegating.
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const featStart = this.start
    const wLo =
      windowStart === undefined
        ? Number.NEGATIVE_INFINITY
        : windowStart - featStart
    const wHi =
      windowEnd === undefined ? Number.POSITIVE_INFINITY : windowEnd - featStart
    readFeaturesToMismatches(
      this.record.readFeatureArena,
      this.record.readFeatureStart,
      this.record.readFeatureCount,
      featStart,
      this.qualRaw,
      wLo,
      wHi,
      callback,
    )
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
