import {
  DELETION_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
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

// Single dispatch loop emitting per-feature CIGAR data. Driven by
// forEachMismatch so no intermediate Mismatch[] is allocated — each branch
// routes the callback primitives straight into a feature folder's emitter.
// extractFeatureArrays runs this for thousands of features per region.
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
    (type, start, length, base, qual, altbase, cliplen) => {
      if (type === MISMATCH_TYPE) {
        emitMismatch(
          start,
          base,
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
      } else {
        emitHardclip(start, cliplen!, readIndex, featureStart, output.hardclips)
      }
    },
    windowStart,
    windowEnd,
  )
}
