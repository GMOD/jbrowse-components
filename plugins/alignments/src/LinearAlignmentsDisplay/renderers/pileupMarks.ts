import { CLIP_MARK } from '../../features/clip/mark.ts'
import { CONNECTING_LINE_MARK } from '../../features/connectingLines/mark.ts'
import { DELETION_MARK, SKIP_MARK } from '../../features/gap/mark.ts'
import { INSERTION_MARK } from '../../features/insertion/mark.ts'
import { LINKED_READ_LINE_MARK } from '../../features/linkedReads/mark.ts'
import { MISMATCH_MARK } from '../../features/mismatch/mark.ts'
import { MODIFICATION_MARK } from '../../features/modification/mark.ts'
import { OVERLAP_MARK } from '../../features/overlap/mark.ts'
import { PER_BASE_LETTER_MARK } from '../../features/perBaseLetter/mark.ts'
import { PER_BASE_QUALITY_MARK } from '../../features/perBaseQuality/mark.ts'
import { READ_MARK } from '../../features/read/mark.ts'
import { SOFTCLIP_BASES_MARK } from '../../features/softclipBases/mark.ts'

import type { ConnectingLinesUploadData } from '../../features/connectingLines/types.ts'
import type { GapUploadData } from '../../features/gap/types.ts'
import type { LinkedReadLinesUploadData } from '../../features/linkedReads/types.ts'
import type { MismatchUploadData } from '../../features/mismatch/types.ts'
import type { ModificationUploadData } from '../../features/modification/types.ts'
import type { OverlapsUploadData } from '../../features/overlap/types.ts'
import type { PerBaseLetterUploadData } from '../../features/perBaseLetter/types.ts'
import type { PerBaseQualityUploadData } from '../../features/perBaseQuality/types.ts'
import type { ReadMarkRegion } from '../../features/read/mark.ts'
import type { SoftclipBasesUploadData } from '../../features/softclipBases/types.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { RenderState } from './rendererTypes.ts'
import type { Mark } from '@jbrowse/render-core/marks'

/**
 * What every pileup mark's `channels` lens can be handed: the union of the
 * per-feature payloads. `PileupDataResult` satisfies it, and so does the
 * Canvas2D region map's entry — each mark reads its own slice of it.
 */
export type PileupRegion = ReadMarkRegion &
  ConnectingLinesUploadData &
  LinkedReadLinesUploadData &
  OverlapsUploadData &
  ModificationUploadData &
  PerBaseQualityUploadData &
  GapUploadData &
  MismatchUploadData &
  InterbaseUploadData &
  SoftclipBasesUploadData &
  PerBaseLetterUploadData

export type PileupMark = Mark<PileupRegion, RenderState>

/**
 * The pileup band's marks, in paint order (back to front). Both renderers walk
 * this list — the GPU through `planMarks` / `drawPlannedPasses`, Canvas2D and
 * the SVG export through the plan's `marks` — and the hit chain asks the same
 * marks, so a layer cannot be added to one backend alone, gated on one alone,
 * or left hoverable over blank pixels: `enabled` is one gate for all three.
 *
 * The coverage band is a mark list of its own (`ALIGNMENTS_COVERAGE_MARKS`),
 * separate because its marks are position-aggregate — packed in the worker,
 * drawn through the shared band — and the arc band another
 * (`ARC_BAND_MARKS`); the three bands share one renderer scaffold and nothing
 * else.
 */
export const PILEUP_MARKS: readonly PileupMark[] = [
  CONNECTING_LINE_MARK,
  LINKED_READ_LINE_MARK,
  READ_MARK,
  OVERLAP_MARK,
  MODIFICATION_MARK,
  PER_BASE_QUALITY_MARK,
  // Both are CIGAR gaps out of one worker array and one shader; they are two
  // marks because they answer to different settings. An intron centerline is
  // STRUCTURE, a deletion bar a DIFFERENCE — `gap/mark.ts` has the argument.
  SKIP_MARK,
  DELETION_MARK,
  MISMATCH_MARK,
  INSERTION_MARK,
  CLIP_MARK,
  SOFTCLIP_BASES_MARK,
  PER_BASE_LETTER_MARK,
]
