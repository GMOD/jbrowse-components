import {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
  forEachMismatchNumeric,
  parseCigar2Typed,
} from '@jbrowse/cigar-utils'

import { emitGap } from '../features/gap/extract.ts'
import { emitHardclip } from '../features/hardclip/extract.ts'
import { emitInsertion } from '../features/insertion/extract.ts'
import { emitMismatch } from '../features/mismatch/extract.ts'
import { emitSoftclip } from '../features/softclip/extract.ts'

import type {
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature } from '@jbrowse/core/util'

// Alignment features (BAM/CRAM) expose a zero-alloc mismatch iterator on top of
// the base Feature interface.
export interface MismatchFeature extends Feature {
  forEachMismatch: (
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) => void
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
        cliplen!,
        base,
        readIndex,
        featureStart,
        output.insertions,
      )
    } else if (type === SOFTCLIP_TYPE) {
      emitSoftclip(
        start,
        cliplen!,
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
        feature,
        output.gaps,
      )
    } else if (type === SKIP_TYPE) {
      emitGap(
        'skip',
        start,
        length,
        readIndex,
        featureStart,
        strand,
        feature,
        output.gaps,
      )
    } else if (type === HARDCLIP_TYPE) {
      emitHardclip(start, cliplen!, readIndex, featureStart, output.hardclips)
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
  feature.forEachMismatch(
    makeCigarEmitter(
      feature,
      readIndex,
      featureStart,
      strand,
      output,
      showSoftClipping,
    ),
    windowStart,
    windowEnd,
  )
}

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
    makeCigarEmitter(
      feature,
      readIndex,
      featureStart,
      strand,
      output,
      showSoftClipping,
    ),
    0,
    // the walk is in read-relative reference offsets, like the BAM one
    windowStart === undefined ? undefined : windowStart - featureStart,
    windowEnd === undefined ? undefined : windowEnd - featureStart,
  )
}
