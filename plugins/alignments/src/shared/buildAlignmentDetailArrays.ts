import { updateStatus } from '@jbrowse/core/util'

import { buildGapArrays } from '../features/gap/buildArrays.ts'
import { buildMismatchArrays } from '../features/mismatch/buildArrays.ts'
import { buildModificationArrays } from '../features/modification/buildArrays.ts'
import { buildPerBaseLetterArrays } from '../features/perBaseLetter/buildArrays.ts'
import { buildPerBaseQualityArrays } from '../features/perBaseQuality/buildArrays.ts'
import { buildSegmentArrays } from '../features/read/buildSegments.ts'
import { buildSoftclipBaseArrays } from '../features/softclipBases/buildArrays.ts'
import { buildInterbaseArrays } from './buildInterbaseArrays.ts'

import type { PerBaseColumns } from '../features/alignedBaseWalk.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { StatusCallback } from '@jbrowse/core/util'

/**
 * Build the gap / mismatch / interbase / modification / segment /
 * softclip-base TypedArrays for a region.
 *
 * `showSoftClips=false` (the default) produces zero-length softclip-base
 * arrays — chain mode uses this so softclip fields are still present in the
 * result with the correct shape. Shown soft clips keep only the bases inside
 * `region`.
 */
export async function buildAlignmentDetailArrays({
  features,
  gaps,
  mismatches,
  insertions,
  softclips,
  hardclips,
  modifications,
  perBaseQualities,
  perBaseLetters,
  showSoftClips = false,
  region,
  statusCallback,
}: {
  features: FeatureData[]
  gaps: GapData[]
  mismatches: MismatchData[]
  insertions: InsertionData[]
  softclips: SoftclipData[]
  hardclips: HardclipData[]
  modifications: ModificationEntry[]
  perBaseQualities: PerBaseColumns
  perBaseLetters: PerBaseColumns
  showSoftClips?: boolean
  region: { start: number; end: number }
  statusCallback: StatusCallback | undefined
}) {
  return updateStatus('Processing alignments', statusCallback, async () => ({
    gapArrays: buildGapArrays(gaps),
    mismatchArrays: buildMismatchArrays(mismatches),
    softclipBaseArrays: buildSoftclipBaseArrays(
      showSoftClips ? softclips : [],
      region.start,
      region.end,
    ),
    interbaseArrays: buildInterbaseArrays(insertions, softclips, hardclips),
    modificationArrays: buildModificationArrays(modifications),
    perBaseQualityArrays: buildPerBaseQualityArrays(perBaseQualities),
    perBaseLetterArrays: buildPerBaseLetterArrays(perBaseLetters),
    segmentArrays: buildSegmentArrays(features, gaps),
  }))
}
