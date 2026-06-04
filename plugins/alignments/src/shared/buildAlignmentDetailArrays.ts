import { updateStatus } from '@jbrowse/core/util'

import { buildInterbaseArrays } from './buildInterbaseArrays.ts'
import { buildGapArrays } from '../features/gap/buildArrays.ts'
import { buildMismatchArrays } from '../features/mismatch/buildArrays.ts'
import { buildModificationArrays } from '../features/modification/buildArrays.ts'
import { buildPerBaseLetterArrays } from '../features/perBaseLetter/buildArrays.ts'
import { buildPerBaseQualityArrays } from '../features/perBaseQuality/buildArrays.ts'
import { buildSegmentArrays } from '../features/read/buildSegments.ts'
import { buildSoftclipBaseArrays } from '../features/softclip/buildArrays.ts'

import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { PerBaseLetterEntry } from '../features/perBaseLetter/types.ts'
import type { PerBaseQualityEntry } from '../features/perBaseQuality/types.ts'
import type { Region } from '@jbrowse/core/util'

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
  getReadIndex,
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
  getReadIndex: (id: string) => number
  showSoftClipping?: boolean
  statusCallback: (s: string) => void
}) {
  const { start: regionStart } = region
  return updateStatus(
    'Building alignment arrays',
    statusCallback,
    async () => ({
      gapArrays: buildGapArrays(gaps, regionStart, getReadIndex),
      mismatchArrays: buildMismatchArrays(
        mismatches,
        regionStart,
        getReadIndex,
      ),
      softclipBaseArrays: buildSoftclipBaseArrays(
        showSoftClipping ? softclips : [],
        getReadIndex,
      ),
      interbaseArrays: buildInterbaseArrays(
        insertions,
        softclips,
        hardclips,
        regionStart,
        getReadIndex,
      ),
      modificationArrays: buildModificationArrays(
        modifications,
        regionStart,
        getReadIndex,
        detectedModifications,
      ),
      perBaseQualityArrays: buildPerBaseQualityArrays(
        perBaseQualities,
        getReadIndex,
      ),
      perBaseLetterArrays: buildPerBaseLetterArrays(
        perBaseLetters,
        getReadIndex,
      ),
      segmentArrays: buildSegmentArrays(features, gaps, region, getReadIndex),
    }),
  )
}
