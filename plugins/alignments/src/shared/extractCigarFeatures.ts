import { emitGap } from '../features/gap/extract.ts'
import { emitHardclip } from '../features/hardclip/extract.ts'
import { emitInsertion } from '../features/insertion/extract.ts'
import { emitMismatch } from '../features/mismatch/extract.ts'
import { emitSoftclip } from '../features/softclip/extract.ts'

import type { Mismatch } from './types.ts'
import type {
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

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

// Single dispatch loop emitting per-feature CIGAR data. Each branch routes
// into a feature folder's emitter. Per-feature primitives are passed
// directly — extractFeatureArrays runs this in a hot loop, so we avoid
// allocating a context object per feature.
export function extractCigarFeatures(
  featureMismatches: Mismatch[],
  featureId: string,
  featureStart: number,
  strand: number,
  feature: Feature,
  output: CigarEmitOutput,
  showSoftClipping: boolean,
) {
  for (const mm of featureMismatches) {
    if (mm.type === 'deletion' || mm.type === 'skip') {
      emitGap(mm, featureId, featureStart, strand, feature, output.gaps)
    } else if (mm.type === 'mismatch') {
      emitMismatch(mm, featureId, featureStart, strand, output.mismatches)
    } else if (mm.type === 'insertion') {
      emitInsertion(mm, featureId, featureStart, output.insertions)
    } else if (mm.type === 'softclip') {
      emitSoftclip(
        mm,
        featureId,
        featureStart,
        feature,
        output.softclips,
        showSoftClipping,
      )
    } else {
      emitHardclip(mm, featureId, featureStart, output.hardclips)
    }
  }
}
