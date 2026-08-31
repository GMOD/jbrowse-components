import { numericCigarToString } from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { convertTagsToPlainArrays } from '../shared/util.ts'
import { packCigar } from './packCigar.ts'

import type { MismatchFeature } from '../shared/extractCigarFeatures.ts'
import type { ParsedSamHeader } from '../shared/util.ts'
import type CramAdapter from './CramAdapter.ts'
import type { CramRecord } from '@gmod/cram'
import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

// Reused across every call of forEachMismatch below, because a fresh literal is
// one allocation per read per render pass and that measured 16.5ms -> 20.7ms on
// 80,177 short reads, most of the cost of delegating at all.
//
// Safe because @gmod/cram reads all three fields before the walk starts, and
// retains none of them: even a callback that walks another feature cannot see a
// mutated window, because its own values are already copied out by then.
const MISMATCH_OPTS: { start?: number; end?: number; origin: number } = {
  start: undefined,
  end: undefined,
  origin: 0,
}

// The one spelling of where a read's RG lives. The RG data series resolved
// through the header wins; a conforming encoder writes nothing else, but a
// nonconforming one can leave RG in the tag block with no @RG line, and
// htslib-family tools still show it. Shared by getTag and the adapter's tag
// filter so the details panel and the filter cannot disagree about a read's RG.
export function cramReadGroup(
  samHeader: ParsedSamHeader | undefined,
  record: CramRecord,
) {
  return samHeader?.readGroups[record.readGroupId] ?? record.getTag('RG')
}

export default class CramSlightlyLazyFeature implements MismatchFeature {
  // parameter properties auto-create the record/adapter fields
  // https://www.typescriptlang.org/docs/handbook/classes.html#parameter-properties
  constructor(
    private record: CramRecord,
    private adapter: CramAdapter,
  ) {}

  private numericCigar?: ArrayLike<number>

  private clipStart?: number

  get name() {
    return this.record.readName
  }

  get start() {
    return this.record.start
  }

  // floored at 1 like parseSam: a zero-width span (fully soft-clipped record)
  // is unfindable by interval search
  get end() {
    return this.start + Math.max(this.record.lengthOnRef ?? 0, 1)
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

  // `mate` was an object per paired record through @gmod/cram 11; from 12 the
  // position is two numbers on the record, under SAM's names for those fields.
  // hasNextPosition() is the test, not truthiness: nextSequenceId is -2 when
  // the file gave no position, which is deliberately distinct from -1, a next
  // segment that has a position but is unplaced.
  get next_ref() {
    return this.record.hasNextPosition()
      ? this.adapter.refIdToName(this.record.nextSequenceId)
      : undefined
  }

  /**
   * The mate's reference as the number the FILE stores, so `buildReadNextRefs`
   * can tell two mates apart without `refIdToName` building a string per read.
   * The BAM twin (over `next_refid`) carries the reasoning.
   *
   * `hasNextPosition()` is the test rather than a `>= 0` check, for the reason
   * `next_ref` above states: `nextSequenceId` is **-2** when the file gave no
   * position at all, which is deliberately distinct from **-1**, a next segment
   * that has a position but is unplaced. Both collapse to the table's -1 slot —
   * "no mate reference to show" — but only one of them is a missing mate.
   */
  get nextRefId() {
    return this.record.hasNextPosition() ? this.record.nextSequenceId : -1
  }

  get next_segment_position() {
    return this.record.hasNextPosition()
      ? `${this.adapter.refIdToName(this.record.nextSequenceId)}:${
          this.record.nextStart + 1
        }`
      : undefined
  }

  get next_pos() {
    return this.record.hasNextPosition() ? this.record.nextStart : undefined
  }

  // Read group lives outside the CRAM tag block, so it is spliced in to match
  // what BAM exposes. Read ~3x per read on the render path and still not
  // memoized: an in-process A/B on volvox-rg.cram (400 reads) put re-spreading
  // at 1.06ms against 1.09ms for a cached copy.
  get tags() {
    const RG = this.adapter.samHeader?.readGroups[this.record.readGroupId]
    return RG === undefined ? this.record.tags : { ...this.record.tags, RG }
  }

  /**
   * One tag, without building the object `tags` above would.
   *
   * `extractFeatureTagValue` duck-types this method and only falls back to
   * `get('tags')` without it, which is the full decode — so before CRAM records
   * grew a `getTag`, every read on the colorBy.tag / sortTag / hasSA paths paid
   * for every unrelated tag on the read to answer for one. `@gmod/cram` measures
   * the targeted read at 3.8-7.8x the object's.
   *
   * The `RG` arm defers to `cramReadGroup`, the same precedence `tags` above
   * spells with its spread: the header's read group wins over any `RG` the tag
   * block carries.
   */
  getTag(tagName: string) {
    return tagName === 'RG'
      ? cramReadGroup(this.adapter.samHeader, this.record)
      : this.record.getTag(tagName)
  }

  get seq() {
    // CRAM stores sequences as strings, not packed like BAM
    // So we return the string directly without encoding/decoding
    return this.record.getReadBases()
  }

  // packed CIGAR array, each entry (length << 4) | opIndex — see packCigar.ts
  // for why only the packing lives on this side.
  //
  // Genuinely lazy, and off the render path entirely: nothing builds it unless a
  // consumer asks for the packed form (per-base colouring, the details panel).
  // That is the difference between CRAM and BAM here — BAM's packed CIGAR is the
  // on-disk layout and `@gmod/bam` hands out a zero-copy view of it, so the
  // `NUMERIC_CIGAR` hint really is free there. CRAM has no CIGAR at all, so
  // every element of this array is manufactured, and for a 49kb ONT read that is
  // ~7,000 operations built and retained on demand.
  //
  // Still memoized, because a consumer that asks once usually asks again, and
  // the adapter's ultra-long feature LRU keeps it across a pan.
  //
  // `fields`, `CIGAR` and `tags` were measured and are deliberately *not*
  // memoized: `fields` and `CIGAR` are read 0 times per read on the render path
  // (only toJSON/details touch them, once), and re-spreading `tags` on each of
  // its ~3 reads per read beats installing a per-instance copy.
  get NUMERIC_CIGAR() {
    this.numericCigar ??= packCigar(this.record)
    return this.numericCigar
  }

  // Start-clip length, read straight off the record rather than out of
  // NUMERIC_CIGAR.
  //
  // This is the one CIGAR value the render path actually wants, and it is a
  // single operation: the first, or the last on the reverse strand. Reading it
  // out of the packed array meant manufacturing the whole array — ~7,000
  // operations for a long ONT read — to look at one of them, and then retaining
  // it. @gmod/cram answers both ends in O(1) off the features at that end, so
  // nothing is built or walked, and the memo below is a number rather than an
  // array — the LRU still pays off across a pan, at 8 bytes instead of ~2 MB per
  // ONT slice.
  //
  // Semantics match clipLengthAtStartOfReadNumeric, including that it inspects
  // only that one operation: a read whose CIGAR is `5H4S…` clips 5, not 9.
  get clipLengthAtStartOfRead() {
    // a reverse-strand read is stored reverse-complemented, so the clip at the
    // start of the read as sequenced is the one at the end of its alignment
    this.clipStart ??=
      this.strand === -1
        ? this.record.getTrailingClipLength()
        : this.record.getLeadingClipLength()
    return this.clipStart
  }

  get CIGAR() {
    return numericCigarToString(this.NUMERIC_CIGAR)
  }

  id() {
    return `${this.adapter.id}-${this.record.uniqueId}`
  }

  /**
   * The number `id()` is built from — cram-js assigns each record a uniqueId
   * within its file. The BAM twin of this (over `fileOffset`) carries the
   * reasoning; both exist for `dedupeById` in the alignments render RPC.
   */
  get recordId() {
    return this.record.uniqueId
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

  // windowStart/windowEnd (genomic, half-open) clip emissions to the viewport,
  // matching BamSlightlyLazyFeature.
  //
  // This used to be a copy of @gmod/cram's own walk, kept here because the two
  // vocabularies disagreed and translating between them cost 17% of this path.
  // They agree now: MISMATCH_TYPE and friends are the CRAM feature codes (see
  // mismatchCallback.ts), and `origin` moves the reported positions into the
  // read-relative space this callback's consumers work in, so `callback` is
  // what the walk itself calls. @gmod/cram ADR 0008 has that story.
  //
  // What it costs, measured on a bundle rather than on node's ESM loader, since
  // that is what ships (interleaved, min of 13 rounds, against the copy it
  // replaced):
  //
  //   628 ONT reads      0.999x, 1.013x, 1.021x   — parity
  //   80,177 short reads 1.088x, 1.111x, 1.132x   — ~10%
  //
  // The cost is per *call*, not per emission: one extra hop, since
  // `record.forEachMismatch` then calls the walk. A long read amortizes it over
  // ~5,000 emissions and a short read has ~7, which is the whole difference
  // between those two rows.
  //
  // Measured unbundled it looks worse (a further ~6%), but that part is an
  // artefact of module boundaries under node's loader — the identical walk,
  // moved to another module, measured 1.065x unbundled and 0.993x bundled. Do
  // not tune this against a node-ESM benchmark.
  //
  // Taken for deleting a 110-line second implementation of the format's
  // trickiest walk — one that had been silently dropping 'B' features, and that
  // nothing but a hand-diff against cram-js's copy would have caught. Revisit
  // if an end-to-end render measurement, not this micro-benchmark, shows the
  // short-read row mattering.
  forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow) {
    MISMATCH_OPTS.start = opts?.start
    MISMATCH_OPTS.end = opts?.end
    MISMATCH_OPTS.origin = this.start
    this.record.forEachMismatch(callback, MISMATCH_OPTS)
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
