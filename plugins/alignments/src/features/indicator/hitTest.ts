import {
  INDICATOR_TRIANGLE_H,
  INDICATOR_TRIANGLE_HW,
  interbaseBarHeightPx,
  interbaseEdgePx,
  nearestRecordIndex,
  readIndicators,
  readInterbaseSegments,
} from '@jbrowse/alignments-core'

import { interbaseTypeName } from '../../shared/types.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { IndicatorHitResult } from './types.ts'

// Horizontal slack (px) so the 1px-wide interbase bars are practical to hover.
const BAR_HIT_HALF_WIDTH_PX = 3
// Vertical slack (px) below the drawn bar bottom.
const BAR_HIT_PAD_PX = 2

// Hovering the interbase histogram — the stacked insertion/softclip/hardclip
// bars in the coverage band, plus the indicator triangles at significant
// positions — resolves to an interbase tooltip. The coverage-depth area below
// the bars stays a plain coverage hit. Both the bars and the triangles are
// gated on showInterbaseIndicators — the one toggle governs all interbase
// marks, so neither is hittable when it's off.
//
// Both marks are read out of the same packed instance buffers the GPU uploads
// and the Canvas2D path draws from, so a hover is tested against the record
// that was painted rather than against a second copy of it.
//
// Every tolerance here is a PIXEL budget converted through bpPerPx, never a bp
// count: the marks are fixed-size on screen, so a bp tolerance means something
// different at every zoom. The triangle's was `max(1, bpPerPx * 5)`, whose
// floor engages below 0.2 bp/px — at 100 px/bp that is 100 CSS px of slack for
// a 7 px mark, and it is the click and right-click targets too.
export function hitTestInterbase(
  genomicPos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showInterbaseIndicators: boolean,
  coverageHeight: number,
  domainMax: number | undefined,
): IndicatorHitResult | undefined {
  // No interbase mark is hittable unless coverage is shown and the user has
  // interbase indicators on — the one toggle governs both the triangles and the
  // count bars.
  //
  // The band's bottom edge bounds the hover the way it bounds the draw, and
  // `interbaseHeight` below cannot supply that bound: it scales the FETCHED
  // block's peak event count against the VISIBLE domain, so a breakpoint far
  // above a bounded or locally autoscaled domain computes a bar hundreds of px
  // long. Both backends scissor that to the band (`covClipTop`/`covClipHeight`,
  // and the GPU's scissor), and with nothing saying so here a ±3bp column ran
  // the full height of the pileup: `performHitTest` asks this first and returns
  // on a hit, so every read hover, click and right-click under it answered
  // interbase. `hitTestCoverage` states the same bound one file over.
  // `coverageHeight` is the band's reserved height, 0 when the band is off —
  // no interbase mark is hittable without the band it draws in.
  if (
    coverageHeight <= 0 ||
    !showInterbaseIndicators ||
    canvasY < 0 ||
    canvasY > coverageHeight
  ) {
    return undefined
  }

  // Indicator triangles: significant positions only, in the top strip. The
  // tolerance is the triangle's own half-width, which is what `drawIndicators`
  // culls on, so the hover reaches exactly the pixels it is painted over.
  if (canvasY <= INDICATOR_TRIANGLE_H) {
    const indicators = readIndicators(rpcData.indicatorPackedBuffer)
    const idx = nearestRecordIndex(
      indicators,
      genomicPos,
      bpPerPx * INDICATOR_TRIANGLE_HW,
    )
    if (idx >= 0) {
      return {
        type: 'indicator',
        position: indicators.position(idx),
        indicatorType: interbaseTypeName(indicators.colorType(idx) || 1),
      }
    }
  }

  // Interbase histogram bars: every interbase position, matched against the
  // actual drawn bar rectangle (top strip down to the stacked bar bottom, the
  // same geometry as drawInterbaseSegments).
  //
  // `interbaseHeight` is the full-scale bar height and doesn't depend on the
  // cursor, so it's computed before the search purely to bound it: stack
  // fractions are normalized 0-1, so no bar can reach below
  // INDICATOR_TRIANGLE_H + interbaseHeight. Without that ceiling, a hover
  // anywhere in the pileup — hundreds of px below the coverage band — still
  // searched the interbase buffer before being rejected by the per-position bar
  // bottom at the end.
  const interbaseHeight = interbaseBarHeightPx(
    coverageHeight,
    rpcData.interbaseMaxCount,
    domainMax,
  )
  if (
    interbaseHeight === 0 ||
    canvasY > INDICATOR_TRIANGLE_H + interbaseHeight + BAR_HIT_PAD_PX
  ) {
    return undefined
  }

  const segments = readInterbaseSegments(rpcData.interbasePackedBuffer)
  const first = nearestRecordIndex(
    segments,
    genomicPos,
    bpPerPx * BAR_HIT_HALF_WIDTH_PX,
  )
  if (first < 0) {
    return undefined
  }

  const pos = segments.position(first)
  // The bar at `pos` is a STACK of up to three differently-coloured segments,
  // so which type the hover means is decided by where in the stack the cursor
  // is — the segment whose drawn band contains it. Reporting the tallest
  // segment instead named a colour that isn't under the cursor, which the
  // tooltip hides (it tables all three types) and the click does not:
  // `openIndicatorWidget` titles the widget by this type and reads
  // `bin.interbase[type]` for its count/length rows, and the context menu
  // offers "Sort by" it.
  //
  // The segments at one position tile the stack with no gaps, so the one the
  // cursor is in is the SHALLOWEST whose bottom edge is at or below it — which
  // needs only each segment's bottom edge, and answers above the stack (every
  // edge qualifies, so the topmost wins) as well as inside it. Below the stack
  // nothing qualifies; that is the BAR_HIT_PAD_PX slack, and it falls back to
  // the bottom-most segment, whose edge the cursor is under.
  //
  // Compared in SCREEN PX through `interbaseEdgePx` — interbaseHistogram
  // .slang's own edge math, which snaps both edges to whole pixels — rather
  // than as a stack fraction. That is what makes "the actual drawn bar
  // rectangle" above literally true: an unsnapped comparison puts each boundary
  // up to half a pixel off the one that was painted.
  //
  // The walk stops at the end of the run because `computeInterbaseCoverage`
  // writes a position's segments consecutively.
  let barBottomPx = 0
  let bottomType = 0
  let hitEdgePx = Infinity
  let hitType = 0
  for (let i = first; i < segments.count && segments.position(i) === pos; i++) {
    const edgePx = interbaseEdgePx(segments.stackEnd(i), interbaseHeight)
    if (edgePx > barBottomPx) {
      barBottomPx = edgePx
      bottomType = segments.colorType(i)
    }
    if (edgePx >= canvasY && edgePx < hitEdgePx) {
      hitEdgePx = edgePx
      hitType = segments.colorType(i)
    }
  }
  return canvasY <= barBottomPx + BAR_HIT_PAD_PX
    ? {
        type: 'indicator',
        position: pos,
        indicatorType: interbaseTypeName(hitType || bottomType),
      }
    : undefined
}
