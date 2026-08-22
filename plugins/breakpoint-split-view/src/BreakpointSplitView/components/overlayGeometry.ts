// The overlay's half of the geometry in ../util.ts, and the reason it is a
// separate file is a bundling one rather than a design one.
//
// model.ts is evaluated at plugin-registration time, so everything it statically
// imports is in the eager set (agent-docs/reference/EAGER_BUNDLE.md). The overlay
// components are not — Overlay.tsx is reached only through a lazy() — but a
// React-free module imported by BOTH sides gets grouped with the LAZY chunk, and
// the eager import of it then drags that whole chunk in. That is how these eight
// components, and @floating-ui behind BreakpointTooltip, became eager on a page
// that never opens a breakpoint split view: 24 KB gzip, none of it from any
// eagerly-evaluated module naming a component.
//
// So the rule this file exists to keep: **nothing under components/ may be
// imported by model.ts or ../util.ts, and nothing model.ts imports may be
// imported from here.** A lazy module importing an eager one is free (the bytes
// are already down); it is the shared module that costs.
//
// findMatchingAlt and computeOverlayX moved here outright — nothing on the model
// side used them. The four below are duplicated, which is the price of the
// boundary, and they are all small and pinned by ../util.test.ts and
// overlayUtils.test.ts on their respective sides.
//
// They read as accidental copies, and a duplication sweep (24aba4d012) undid
// three of them — pointing this file, BreakpointSplitView.tsx and
// overlayUtils.tsx at ../util.ts. Nothing failed: tsc passed and so did every
// suite, because the only thing that disagreed was the byo examples site's
// eager-bundle budget, which needs a full Astro build to say anything. It
// measured 678 -> 690 KB gzip on the synteny page. Restored, and
// ../eagerBoundary.test.ts now fails on the import instead of the bundle.
import { notEmpty } from '@jbrowse/core/util'
import { getLayoutHighlightCoords } from '@jbrowse/core/util/Base1DUtils'
import { safeParseBreakend } from '@jbrowse/sv-core'

import type { LayoutRecord, OverlayLevel } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

// The ALT of feat1 that names feat2's position as its mate, so Breakends can ask
// which side of the junction it is drawing. Moved off the model side with
// nothing left behind: only this component ever called it.
export function findMatchingAlt(feat1: Feature, feat2: Feature) {
  const alts = feat1.get('ALT') as string[] | undefined
  const target = `${feat2.get('refName')}:${feat2.get('start') + 1}`
  return alts
    ?.map(alt => safeParseBreakend(alt))
    .filter(notEmpty)
    .find(bnd => bnd.MatePosition === target)
}

// Mirrors VIEW_DIVIDER_HEIGHT in ../util.ts, which is also the CSS height of
// viewDivider in BreakpointSplitView.tsx. Three numbers that must agree; the
// other two are one import apart.
export const VIEW_DIVIDER_HEIGHT = 3

// Mirrors OFFSCREEN_Y_SENTINEL in ../util.ts. The pair is what makes the two
// isOffscreenLayout copies read the same records, so they move together.
export const OFFSCREEN_Y_SENTINEL = Number.POSITIVE_INFINITY

export function isOffscreenLayout(c: LayoutRecord) {
  return c[1] === OFFSCREEN_Y_SENTINEL
}

// Horizontal screen position of an overlay endpoint, the sibling of
// computeOverlayY in ../util.ts and clamped for the same reason.
//
// A feature with no row in any track's layout is off-display in BOTH axes, and
// computeOverlayY deliberately snaps its y to the track's bottom edge so the
// curve terminating there is the one sign the segment exists. Leaving x at the
// true coordinate defeats that: the point it terminates at is outside the panel,
// so the curve simply leaves the frame on a diagonal and the reader sees a line
// to nowhere rather than a marker at the edge. Clamping x puts the terminus back
// in view, on the side the segment actually lies.
//
// An on-display feature keeps its true x even when that is off-panel — a long
// read whose alignment runs past the window has a real row, a real y, and an x
// that means something. Only the synthesized record is clamped.
export function computeOverlayX(
  x: number,
  width: number,
  layout: LayoutRecord,
) {
  return isOffscreenLayout(layout) ? Math.min(Math.max(x, 0), width) : x
}

// Screen rect of one laid-out feature — the rectangle computeOverlayY resolves
// down to a single midpoint, kept whole so the hover highlight can box the read
// a connector points at.
//
// getLayoutHighlightCoords rather than a bpToPx per edge: a read in a breakpoint
// panel routinely starts before the displayed region and ends after it, and
// bpToPx answers undefined for such an edge — which would drop the box for
// exactly the long reads a split view is opened to look at. It carries the
// min-width floor and the reversed-view handling too.
//
// Undefined once the clamps close the rect: an off-display segment (see
// makeOffscreenLayout), one scrolled out of its pileup, or one whose span lies
// entirely off the panel. There is no read on screen to box in any of those, and
// the connector terminating on the panel's bottom edge is already the only sign
// an off-display segment exists.
export function computeOverlayRect({
  level,
  layout,
  refName,
  viewLayout,
}: {
  level: OverlayLevel
  layout: LayoutRecord
  refName: string
  viewLayout: ViewLayout
}) {
  const [startBp, layoutTop, endBp, layoutBottom] = layout
  const coords = isOffscreenLayout(layout)
    ? undefined
    : getLayoutHighlightCoords(viewLayout, {
        refName,
        start: startBp,
        end: endBp,
      })
  if (coords) {
    const { yOffset, height, coverageOffset, scrollTop } = level
    const left = Math.max(coords.left, 0)
    const right = Math.min(coords.left + coords.width, viewLayout.width)
    const top = Math.max(layoutTop - scrollTop + coverageOffset, coverageOffset)
    const bottom = Math.min(layoutBottom - scrollTop + coverageOffset, height)
    if (right > left && bottom > top) {
      return {
        x: left,
        y: yOffset + top,
        width: right - left,
        height: bottom - top,
      }
    }
  }
  return undefined
}

// Mirrors findFeatureViewLevel in ../util.ts: which row (level) of the split
// view a feature belongs to, by which view's displayedRegions contain it.
// Region membership, NOT scroll/zoom — the feature may still be horizontally
// off-screen within the chosen level.
export function findFeatureViewLevel(
  views: {
    bpToPx: (a: { refName: string; coord: number }) => unknown
  }[],
  refName: string,
  coord: number,
) {
  for (let level = 0; level < views.length; level++) {
    if (views[level]!.bpToPx({ refName, coord })) {
      return level
    }
  }
  return undefined
}
