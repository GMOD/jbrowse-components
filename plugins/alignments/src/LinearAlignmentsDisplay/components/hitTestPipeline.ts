import { hitTestCoverage } from '../../features/coverage/hitTest.ts'
import { hitTestGap } from '../../features/gap/hitTest.ts'
import { hitTestInterbase } from '../../features/indicator/hitTest.ts'
import {
  hitTestLargeInsertion,
  hitTestSmallInsertion,
} from '../../features/insertion/hitTest.ts'
import { hitTestMismatch } from '../../features/mismatch/hitTest.ts'
import { hitTestModification } from '../../features/modification/hitTest.ts'
import { hitTestFeature } from '../../features/read/hitTest.ts'
import { hitTestClip } from '../../shared/clipPass.ts'
import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { CoverageHitResult } from '../../features/coverage/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

export type HitTestResult =
  | { type: 'indicator'; hit: IndicatorHitResult; resolved: ResolvedBlock }
  | { type: 'coverage'; hit: CoverageHitResult; resolved: ResolvedBlock }
  | {
      type: 'cigar'
      hit: CigarHitResult
      featureHit?: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | {
      type: 'modification'
      hit: ModificationHitResult
      featureHit?: { id: string; index: number }
      cigarHit?: CigarHitResult
      resolved: ResolvedBlock
    }
  | {
      type: 'feature'
      hit: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | { type: 'none' }

// Above ~50kbp visible region (2000px / 50000bp = 25), per-base detail is
// too zoomed out to be meaningful.
export const SNP_HIT_MAX_BP_PER_PX = 25

export interface ContextMenuFields {
  // false for coverage/none hits, which have no right-click menu
  show: boolean
  cigarHit?: CigarHitResult
  indicatorHit?: IndicatorHitResult
  modHit?: ModificationHitResult
  featureId?: string
}

// Which context-menu state a right-click hit maps to. A cigar/modification hit
// carries the read's featureId so the read's own menu items (view mate, feature
// details) stay reachable over a mismatched/modified base — not just bare body.
// A modification hit also carries the underlying cigarHit (its mismatch, if the
// modified base is also a SNP), so the SNP submenu appears next to the mod item.
export function contextMenuFieldsForHit(
  result: HitTestResult,
): ContextMenuFields {
  switch (result.type) {
    case 'cigar':
      return {
        show: true,
        cigarHit: result.hit,
        featureId: result.featureHit?.id,
      }
    case 'modification':
      return {
        show: true,
        cigarHit: result.cigarHit,
        modHit: result.hit,
        featureId: result.featureHit?.id,
      }
    case 'indicator':
      return { show: true, indicatorHit: result.hit }
    case 'feature':
      return { show: true, featureId: result.hit.id }
    default:
      return { show: false }
  }
}

function hitTestChain(
  coords: CigarCoords,
  rpcData: PileupDataResult,
  featureHeight: number,
) {
  if (!rpcData.chainFlatbush || !rpcData.chainFirstReadIndices) {
    return undefined
  }
  const { adjustedY, yWithinRow, genomicPos, row } = coords
  // Same clickable band as hitTestFeature: the featureSpacing gap between rows
  // must not register a hit (it rounds to the row above).
  if (adjustedY < 0 || yWithinRow > featureHeight) {
    return undefined
  }
  const hits = rpcData.chainFlatbush.search(genomicPos, row, genomicPos, row)
  if (hits.length === 0) {
    return undefined
  }
  const readIdx = rpcData.chainFirstReadIndices[hits[0]!]!
  return { id: rpcData.readIds[readIdx]!, index: readIdx }
}

export interface HitTestOptions {
  showCoverage: boolean
  showInterbaseIndicators: boolean
  coverageHeight: number
  // Autoscaled coverage domain max (global across groups), needed to reproduce
  // the interbase histogram bar heights for hit-testing. Undefined until the
  // debounced autoscale resolves.
  coverageMaxDepth: number | undefined
  topOffset: number
  // Screen-px Y of this section's coverage band top. 0 for the ungrouped
  // sticky-at-top coverage; a stacked group's scrolled coverage top otherwise.
  // Subtracted from canvasY so the coverage/indicator strip tests are
  // section-local.
  coverageTopOffset: number
  featureHeight: number
  featureSpacing: number
  scrollTop: number
  isChainMode: boolean
  // Mirrors the draw-time alpha gate: when true, low-frequency mismatches fade
  // (and stop being clickable) once zoomed out; when false they draw opaque and
  // stay clickable at every zoom.
  filterMismatchesByFrequency: boolean
  // False when this section's pileup band is collapsed to zero height
  // (`showPileup` off, or a collapsed group): reads are laid out but not drawn,
  // so the per-read/cigar/modification tests must be skipped to avoid resolving
  // a hover over the empty band. Coverage/indicator tests still run.
  pileupVisible: boolean
}

// Priority chain across CIGAR features, top-down:
//  1. large insertions (wide boxes that overlap SNPs)
//  2. mismatches (1bp features under the cursor base)
//  3. small insertions (thin bars that don't overlap SNPs)
//  4. gaps (deletions/skips spanning the read body)
//  5. softclips, then hardclips (interbase bars at alignment edges)
function hitTestCigarItem(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { adjustedY, yWithinRow } = coords
  if (adjustedY < 0 || yWithinRow > featureHeight) {
    return undefined
  }
  return (
    hitTestLargeInsertion(resolved, coords, featureHeight) ??
    hitTestMismatch(resolved, coords, filterMismatchesByFrequency) ??
    hitTestSmallInsertion(
      resolved,
      coords,
      featureHeight,
      filterMismatchesByFrequency,
    ) ??
    hitTestGap(resolved, coords) ??
    hitTestClip(resolved, coords, 'softclip') ??
    hitTestClip(resolved, coords, 'hardclip')
  )
}

// Single site for the canvas-X → genomicPos transform; `reversed` is handled
// here and nowhere else. Used by the hit-test pipeline and by the right-click
// handler to anchor a "sort at the clicked column" action.
export function canvasXToGenomicPos(canvasX: number, resolved: ResolvedBlock) {
  const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
  const frac = (canvasX - resolved.blockStartPx) / resolved.blockWidth
  return resolved.reversed
    ? resolved.bpRange[1] - frac * bpSpan
    : resolved.bpRange[0] + frac * bpSpan
}

export function performHitTest(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  options: HitTestOptions,
): HitTestResult {
  const {
    showCoverage,
    showInterbaseIndicators,
    coverageHeight,
    coverageMaxDepth,
    topOffset,
    coverageTopOffset,
    featureHeight,
    featureSpacing,
    scrollTop,
    isChainMode,
    filterMismatchesByFrequency,
    pileupVisible,
  } = options

  // Coverage/indicator strip tests are relative to this section's coverage top
  // (0 = the ungrouped sticky band at the canvas top).
  const coverageY = canvasY - coverageTopOffset

  if (resolved) {
    const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
    const bpPerPx = bpSpan / resolved.blockWidth
    const genomicPos = canvasXToGenomicPos(canvasX, resolved)

    // Indicator and coverage tooltips work at all zoom levels.
    // hitTestInterbase fires over the interbase histogram bars + indicator
    // triangles, taking priority over coverage so hovering a bar shows interbase.
    // hitTestCoverage handles zoomed-out bins: returns the bin position and snaps
    // to any significant SNP within the bin when bpPerPx > 1.
    const indicatorHit = hitTestInterbase(
      genomicPos,
      bpPerPx,
      coverageY,
      resolved.rpcData,
      showCoverage,
      showInterbaseIndicators,
      coverageHeight,
      coverageMaxDepth,
    )
    if (indicatorHit) {
      return { type: 'indicator', hit: indicatorHit, resolved }
    }

    const coverageHit = hitTestCoverage(
      genomicPos,
      bpPerPx,
      coverageY,
      resolved.rpcData,
      showCoverage,
      coverageHeight,
    )
    if (coverageHit) {
      return { type: 'coverage', hit: coverageHit, resolved }
    }

    // A collapsed pileup band (showPileup off / collapsed group) lays reads out
    // but never paints them, so don't resolve hovers over the empty band.
    if (!pileupVisible) {
      return { type: 'none' }
    }

    const coords = canvasToGenomicCoords(
      canvasY,
      genomicPos,
      bpPerPx,
      featureHeight,
      featureSpacing,
      topOffset,
      scrollTop,
    )

    if (bpPerPx <= SNP_HIT_MAX_BP_PER_PX) {
      // Modification before CIGAR: a modified+mismatched base resolves as a
      // modification hit, not a mismatch hit. modFlatbush is undefined when
      // not in modification mode so this is a no-op.
      const modificationHit = hitTestModification(
        resolved,
        coords,
        featureHeight,
      )
      const cigarHit = hitTestCigarItem(
        resolved,
        coords,
        featureHeight,
        filterMismatchesByFrequency,
      )
      if (modificationHit) {
        return {
          type: 'modification',
          hit: modificationHit,
          featureHit: hitTestFeature(resolved, coords, featureHeight),
          cigarHit,
          resolved,
        }
      }
      if (cigarHit) {
        return {
          type: 'cigar',
          hit: cigarHit,
          featureHit: hitTestFeature(resolved, coords, featureHeight),
          resolved,
        }
      }
    } else if (coords.adjustedY >= 0 && coords.yWithinRow <= featureHeight) {
      // When zoomed out, surface features that are still visually significant.
      // Mirror hitTestCigarItem's adjustedY/yWithinRow guards so inter-row
      // spacing doesn't produce false hits.
      const largeInsertionHit = hitTestLargeInsertion(
        resolved,
        coords,
        featureHeight,
      )
      if (largeInsertionHit) {
        return { type: 'cigar', hit: largeInsertionHit, resolved }
      }
      const gapHit = hitTestGap(resolved, coords)
      if (gapHit && (gapHit.length ?? 0) >= bpPerPx) {
        return { type: 'cigar', hit: gapHit, resolved }
      }
    }

    const hit = isChainMode
      ? hitTestChain(coords, resolved.rpcData, featureHeight)
      : hitTestFeature(resolved, coords, featureHeight)
    if (hit) {
      return { type: 'feature', hit, resolved }
    }
  }

  return { type: 'none' }
}
