import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
  interbaseBarHeightPx,
  interbaseEdgePx,
} from '@jbrowse/alignments-core'

import { interbaseTypeName } from '../../shared/types.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { IndicatorHitResult } from './types.ts'

// Horizontal slack (px) so the 1px-wide interbase bars are practical to hover.
const BAR_HIT_HALF_WIDTH_PX = 3
// Vertical slack (px) below the drawn bar bottom.
const BAR_HIT_PAD_PX = 2

// Index of the interbase position nearest genomicPos within tolerance, or -1.
//
// The tolerance is always a PIXEL budget converted through bpPerPx, never a bp
// count: both marks are fixed-size on screen, so a bp tolerance means something
// different at every zoom. The triangle's was `max(1, bpPerPx * 5)`, and that
// floor only engages below 0.2 bp/px — where 1 bp is over 5 px and, at 100
// px/bp, a hundred of them. It answered "indicator" for a triangle most of a
// screen away, and not only in the tooltip: the click opens a widget titled by
// this type and the right-click offers to sort by it.
function nearestPositionIndex(
  positions: Uint32Array,
  genomicPos: number,
  toleranceBp: number,
) {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < positions.length; i++) {
    const dist = Math.abs(genomicPos - positions[i]!)
    if (dist < toleranceBp && dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

// Hovering the interbase histogram — the stacked insertion/softclip/hardclip
// bars in the coverage band, plus the indicator triangles at significant
// positions — resolves to an interbase tooltip. The coverage-depth area below
// the bars stays a plain coverage hit. Both the bars and the triangles are
// gated on showInterbaseIndicators — the one toggle governs all interbase
// marks, so neither is hittable when it's off.
export function hitTestInterbase(
  genomicPos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  showInterbaseIndicators: boolean,
  coverageHeight: number,
  domainMax: number | undefined,
): IndicatorHitResult | undefined {
  let hit: IndicatorHitResult | undefined

  // No interbase mark is hittable unless coverage is shown and the user has
  // interbase indicators on — the one toggle governs both the triangles and the
  // count bars.
  const interbaseVisible = showCoverage && showInterbaseIndicators

  // Indicator triangles: significant positions only, in the top strip.
  if (interbaseVisible && canvasY >= 0 && canvasY <= INDICATOR_TRIANGLE_H) {
    const { indicatorPositions, indicatorColorTypes } = rpcData
    // The triangle's own half-width, which is what `drawIndicators` culls on —
    // so the hover reaches exactly the pixels the mark is painted over.
    const idx = nearestPositionIndex(
      indicatorPositions,
      genomicPos,
      bpPerPx * INDICATOR_TRIANGLE_HW,
    )
    if (idx >= 0) {
      hit = {
        type: 'indicator',
        position: indicatorPositions[idx]!,
        indicatorType: interbaseTypeName(indicatorColorTypes[idx] ?? 1),
      }
    }
  }

  // Interbase histogram bars: every interbase position, matched against the
  // actual drawn bar rectangle (top strip down to the stacked bar bottom, the
  // same geometry as drawInterbaseSegments).
  //
  // `interbaseHeight` is the full-scale bar height and doesn't depend on the
  // cursor, so it's computed before the scans purely to bound them: yOffsets are
  // normalized 0-1 (see PileupDataResult), so no bar can reach below
  // INDICATOR_TRIANGLE_H + interbaseHeight. Without that ceiling, a hover
  // anywhere in the pileup — hundreds of px below the coverage band — still ran
  // both O(n) passes over the interbase arrays before being rejected by the
  // per-position bar bottom at the end.
  const interbaseHeight = interbaseBarHeightPx(
    coverageHeight,
    rpcData.interbaseMaxCount,
    domainMax,
  )
  if (
    !hit &&
    interbaseVisible &&
    interbaseHeight > 0 &&
    canvasY >= 0 &&
    canvasY <= INDICATOR_TRIANGLE_H + interbaseHeight + BAR_HIT_PAD_PX
  ) {
    const {
      interbaseCovPositions,
      interbaseCovYOffsets,
      interbaseCovHeights,
      interbaseCovColorTypes,
    } = rpcData
    const nearestIdx = nearestPositionIndex(
      interbaseCovPositions,
      genomicPos,
      bpPerPx * BAR_HIT_HALF_WIDTH_PX,
    )
    if (nearestIdx >= 0) {
      const pos = interbaseCovPositions[nearestIdx]!
      // The bar at `pos` is a STACK of up to three differently-coloured
      // segments, so which type the hover means is decided by where in the stack
      // the cursor is — the segment whose drawn band contains it. Reporting the
      // tallest segment instead named a colour that isn't under the cursor,
      // which the tooltip hides (it tables all three types) and the click does
      // not: `openIndicatorWidget` titles the widget by this type and reads
      // `bin.interbase[type]` for its count/length rows, and the context menu
      // offers "Sort by" it.
      //
      // The segments at one position tile the stack with no gaps, so the one the
      // cursor is in is the SHALLOWEST whose bottom edge is at or below it —
      // which needs only each segment's bottom edge, and answers above the stack
      // (every edge qualifies, so the topmost wins) as well as inside it. Below
      // the stack nothing qualifies; that is the BAR_HIT_PAD_PX slack, and it
      // falls back to the bottom-most segment, whose edge the cursor is under.
      //
      // Compared in SCREEN PX through `interbaseEdgePx` — interbaseHistogram
      // .slang's own edge math, which snaps both edges to whole pixels — rather
      // than as a stack fraction. That is what makes "the actual drawn bar
      // rectangle" above literally true: an unsnapped comparison puts each
      // boundary up to half a pixel off the one that was painted.
      let barBottomPx = 0
      let bottomType = 0
      let hitEdgePx = Infinity
      let hitType = 0
      for (let i = 0; i < interbaseCovPositions.length; i++) {
        if (interbaseCovPositions[i] === pos) {
          const edgePx = interbaseEdgePx(
            interbaseCovYOffsets[i]! + interbaseCovHeights[i]!,
            interbaseHeight,
          )
          if (edgePx > barBottomPx) {
            barBottomPx = edgePx
            bottomType = interbaseCovColorTypes[i]!
          }
          if (edgePx >= canvasY && edgePx < hitEdgePx) {
            hitEdgePx = edgePx
            hitType = interbaseCovColorTypes[i]!
          }
        }
      }
      if (canvasY <= barBottomPx + BAR_HIT_PAD_PX) {
        hit = {
          type: 'indicator',
          position: pos,
          indicatorType: interbaseTypeName(hitType || bottomType),
        }
      }
    }
  }

  return hit
}
