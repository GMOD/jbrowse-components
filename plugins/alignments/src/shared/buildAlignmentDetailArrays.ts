import { updateStatus } from '@jbrowse/core/util'

import { buildGapArrays } from '../features/gap/buildArrays.ts'
import { buildMismatchArrays } from '../features/mismatch/buildArrays.ts'
import { buildModificationArrays } from '../features/modification/buildArrays.ts'
import { buildPerBaseLetterArrays } from '../features/perBaseLetter/buildArrays.ts'
import { buildPerBaseQualityArrays } from '../features/perBaseQuality/buildArrays.ts'
import { buildSegmentArrays } from '../features/read/buildSegments.ts'
import { buildSoftclipBaseArrays } from '../features/softclip/buildArrays.ts'
import { buildInterbaseArrays } from './buildInterbaseArrays.ts'

import type { PerBaseLetterEntry } from '../features/perBaseLetter/types.ts'
import type { PerBaseQualityEntry } from '../features/perBaseQuality/types.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'

/**
 * Build the gap / mismatch / interbase / modification / segment /
 * softclip-base TypedArrays for a region. Single shared call site so the set
 * of detail arrays produced (and the order in which they're built) cannot
 * drift between the pileup and chain executors.
 *
 * `showSoftClipping=false` (the default) produces zero-length softclip-base
 * arrays — chain mode uses this so softclip fields are still present in the
 * result with the correct shape.
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
  detectedModifications,
  region,
  showSoftClipping = false,
  statusCallback,
}: {
  features: FeatureData[]
  gaps: GapData[]
  mismatches: MismatchData[]
  insertions: InsertionData[]
  softclips: SoftclipData[]
  hardclips: HardclipData[]
  modifications: ModificationEntry[]
  perBaseQualities: PerBaseQualityEntry[]
  perBaseLetters: PerBaseLetterEntry[]
  detectedModifications: Set<string>
  region: Region
  showSoftClipping?: boolean
  statusCallback: StatusCallback
}) {
  const { start: regionStart } = region
  return updateStatus(
    'Building alignment arrays',
    statusCallback,
    async () => ({
      gapArrays: buildGapArrays(gaps, regionStart),
      mismatchArrays: buildMismatchArrays(mismatches, regionStart),
      softclipBaseArrays: buildSoftclipBaseArrays(
        showSoftClipping ? softclips : [],
      ),
      interbaseArrays: buildInterbaseArrays(
        insertions,
        softclips,
        hardclips,
        regionStart,
      ),
      modificationArrays: buildModificationArrays(
        modifications,
        regionStart,
        detectedModifications,
      ),
      perBaseQualityArrays: buildPerBaseQualityArrays(perBaseQualities),
      perBaseLetterArrays: buildPerBaseLetterArrays(perBaseLetters),
      segmentArrays: buildSegmentArrays(features, gaps, region),
    }),
  )
}
