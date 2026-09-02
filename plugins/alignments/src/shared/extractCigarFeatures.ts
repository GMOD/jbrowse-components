import { forEachMismatchNumeric } from '@gmod/bam'
import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
  parseCigar2Typed,
} from '@jbrowse/cigar-utils'

import { emitHardclip, emitSoftclip } from '../features/clip/extract.ts'
import { emitGap, getEffectiveStrand } from '../features/gap/extract.ts'
import { emitInsertion } from '../features/insertion/extract.ts'
import { emitMismatch } from '../features/mismatch/extract.ts'

import type {
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'
import type { Feature } from '@jbrowse/core/util'

/**
 * The capability an alignment source adds on top of `Feature`: per-base CIGAR
 * detail. BAM, CRAM and SAM implement it; a synteny/PAF block does not.
 *
 * Implemented explicitly (`implements MismatchFeature`) by all three adapter
 * feature classes, so this is the checked contract rather than a convention.
 * That matters because the render path reads most of it through the untyped
 * `feature.get(<string>)`, where a member that quietly went missing produced no
 * error — just a blank overlay or a NaN.
 *
 * Required vs. optional is the whole point of the split below.
 */
export interface MismatchFeature extends Feature {
  // The zero-alloc mismatch iterator, and the discriminator `isMismatchFeature`
  // probes for.
  forEachMismatch: (callback: MismatchCallback, opts?: MismatchWindow) => void

  // REQUIRED. The render path reads the start clip from here instead of
  // building a CIGAR string per read — expensive for CRAM, which stores no
  // CIGAR. BAM and SAM read it off the packed CIGAR
  // (`clipLengthAtStartOfReadNumeric`); CRAM answers in O(1) off the read
  // features at that end.
  readonly clipLengthAtStartOfRead: number

  // OPTIONAL — a performance hint, never a requirement. The packed
  // `(len << 4) | opIndex` CIGAR. A source that has only the text `CIGAR` omits
  // it and renders identically — `packedCigarOps` (features/alignedBaseWalk.ts)
  // parses the string instead. Anything reading this MUST go through that
  // helper, or the hint silently becomes a requirement.
  //
  // It is only free for BAM, where the packed array *is* the on-disk layout and
  // `@gmod/bam` hands out a zero-copy view of it. CRAM stores no CIGAR at all:
  // every element is reconstructed from the read features, ~7,000 of them for a
  // 49kb ONT read. So CramSlightlyLazyFeature builds this lazily and keeps it
  // off the render path — `clipLengthAtStartOfRead`, the one CIGAR value the
  // render path wants per read, comes from `CramRecord.getLeadingClipLength()`
  // in O(1) instead. Don't "optimize" that back into an eager NUMERIC_CIGAR.
  readonly NUMERIC_CIGAR?: ArrayLike<number>
}

// Only BAM/CRAM features carry per-base mismatch/CIGAR detail. Other features
// routed through the alignments render path — notably synteny features shown in
// an LGVSyntenyDisplay — have no `forEachMismatch`, so skip CIGAR extraction for
// them (mirrors the pre-refactor `if (feature.get('mismatches'))` guard).
export function isMismatchFeature(
  feature: Feature,
): feature is MismatchFeature {
  return 'forEachMismatch' in feature
}

// Output buffers each emitter pushes into. Bundled to keep the dispatch
// signature short; the caller allocates this once per region (not per
// feature) and the per-feature emitters share it.
export interface CigarEmitOutput {
  gaps: GapData[]
  mismatches: MismatchData[]
  insertions: InsertionData[]
  softclips: SoftclipData[]
  hardclips: HardclipData[]
}

// Single dispatch loop emitting per-feature CIGAR data. No intermediate
// Mismatch[] is allocated — each branch routes the callback primitives straight
// into a feature folder's emitter. extractFeatureArrays runs this for thousands
// of features per region, so the callback is built once per feature.
function makeCigarEmitter(
  feature: Feature,
  readIndex: number,
  featureStart: number,
  strand: number,
  output: CigarEmitOutput,
  showSoftClipping: boolean,
): MismatchCallback {
  // Resolved once per read, and only if a skip actually turns up: it costs two
  // `feature.get()` calls, and most reads have no skip at all. Hoisted out of
  // `emitGap` because it is a property of the read, not of the gap — see
  // getEffectiveStrand.
  let skipStrand: number | undefined
  return (type, start, length, base, qual, _altbase, cliplen) => {
    if (type === MISMATCH_TYPE) {
      emitMismatch(
        start,
        base,
        qual,
        readIndex,
        featureStart,
        strand,
        output.mismatches,
      )
    } else if (type === INSERTION_TYPE) {
      emitInsertion(
        start,
        cliplen,
        base,
        readIndex,
        featureStart,
        output.insertions,
      )
    } else if (type === SOFTCLIP_TYPE) {
      emitSoftclip(
        start,
        cliplen,
        readIndex,
        featureStart,
        feature,
        output.softclips,
        showSoftClipping,
      )
    } else if (type === DELETION_TYPE) {
      emitGap(
        'deletion',
        start,
        length,
        readIndex,
        featureStart,
        strand,
        strand,
        output.gaps,
      )
    } else if (type === SKIP_TYPE) {
      skipStrand ??= getEffectiveStrand(feature)
      emitGap(
        'skip',
        start,
        length,
        readIndex,
        featureStart,
        strand,
        skipStrand,
        output.gaps,
      )
    } else if (type === HARDCLIP_TYPE) {
      emitHardclip(start, cliplen, readIndex, featureStart, output.hardclips)
    }
  }
}

// BAM/CRAM features drive the emitter off their own zero-alloc iterator.
export function extractCigarFeatures(
  feature: MismatchFeature,
  readIndex: number,
  featureStart: number,
  strand: number,
  output: CigarEmitOutput,
  showSoftClipping: boolean,
  windowStart?: number,
  windowEnd?: number,
) {
  // The window object is reused across features rather than allocated per
  // feature: every implementation reads `start`/`end` before returning, and
  // this runs for thousands of features per region.
  WINDOW.start = windowStart
  WINDOW.end = windowEnd
  feature.forEachMismatch(
    makeCigarEmitter(
      feature,
      readIndex,
      featureStart,
      strand,
      output,
      showSoftClipping,
    ),
    WINDOW,
  )
}

const WINDOW: MismatchWindow = {}

// Everything else that carries an alignment carries it as a CIGAR *string* — a
// PAF/PIF synteny block is the case in this repo — so walk that instead. It is
// the same walk BAM uses: forEachMismatchNumeric's no-sequence branch emits the
// ops that need no bases (I/D/N/S/H) and no mismatches, which is all a CIGAR on
// its own can support. Without this, the display purpose-built for assembly
// alignments (LGVSyntenyDisplay, which reuses this render path) draws every
// alignment as a plain block: a 113 kb insertion in a contig looks like no
// insertion at all.
const NO_SEQ = new Uint8Array(0)

export function extractCigarFeaturesFromString(
  feature: Feature,
  cigar: string,
  readIndex: number,
  featureStart: number,
  strand: number,
  output: CigarEmitOutput,
  showSoftClipping: boolean,
  windowStart?: number,
  windowEnd?: number,
) {
  forEachMismatchNumeric(
    parseCigar2Typed(cigar),
    NO_SEQ,
    0,
    undefined,
    undefined,
    undefined,
    featureStart,
    // the window is genomic; `origin` is what makes the emitted positions
    // read-relative, like the BAM one
    windowStart ?? Number.NEGATIVE_INFINITY,
    windowEnd ?? Number.POSITIVE_INFINITY,
    featureStart,
    makeCigarEmitter(
      feature,
      readIndex,
      featureStart,
      strand,
      output,
      showSoftClipping,
    ),
  )
}
