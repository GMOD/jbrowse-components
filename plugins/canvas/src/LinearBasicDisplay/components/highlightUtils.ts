// JBrowse's own `alpha`, not Material UI's — same `rgba(r, g, b, a)` output, but
// this module is reached from the pure Canvas2D painter and the SVG export, and
// neither should drag @mui/material along. `overlayBoxStyles`, the other half of
// these colors, already imports it from here.
import { alpha } from '@jbrowse/core/ui/palette'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// The one definition of the highlight box's border/tint, shared by the
// on-screen DOM overlay (searchHighlightBox) and the SVG export's vector
// post-pass, which paints the same boxes with a different backend. Both used to
// carry their own alpha literals kept in step by a comment, so an export could
// silently stop matching what the user saw.
//
// The tint stays translucent because it lies over the feature glyph: it has to
// read as a highlight without washing out the exon/UTR colors underneath.
export function highlightBoxColors(highlightMain: string) {
  return {
    border: alpha(highlightMain, 0.9),
    fill: alpha(highlightMain, 0.25),
  }
}

// The screen rect a laid-out item occupies inside ONE visible region: its bp
// span mapped to px and clamped to the region, so a box drawn for a feature
// running past the region edge can't bleed over its neighbour. Callers walk
// every visible region on the feature's refName, so a feature spanning a
// displayed-region boundary is boxed piecewise.
//
// undefined means "contributes no pixels here". That covers plain no-overlap
// AND the case a bp test alone misses: a feature whose span merely TOUCHES the
// edge (endBp === vr.start, the normal shape at a displayed-region boundary)
// clamps to zero width, and computeOverlayRect would inflate that nothing into a
// phantom stripe — the padding plus the feature's full label overhang — at the
// neighbouring region's edge, for a feature drawn entirely in the previous one.
// A genuinely zero-length feature is kept: zero width is its true extent there
// rather than the clamp's doing — but only where it lands inside the region.
// One outside it clamps to a rect whose right edge precedes its left, and a
// negative width paints a phantom box for an insertion scrolled out of view.
export function overlayItemRect(
  item: { startBp: number; endBp: number; topPx: number; bottomPx: number },
  vr: BpRegionBounds,
) {
  const toScreen = makeBpMapper(vr)
  const px1 = toScreen(item.startBp)
  const px2 = toScreen(item.endBp)
  const leftPx = Math.max(vr.screenStartPx, Math.min(px1, px2))
  const rightPx = Math.min(vr.screenEndPx, Math.max(px1, px2))
  const clampedToNothing =
    rightPx < leftPx || (rightPx === leftPx && item.endBp > item.startBp)
  return clampedToNothing
    ? undefined
    : {
        leftPx,
        width: rightPx - leftPx,
        topPx: item.topPx,
        heightPx: item.bottomPx - item.topPx,
      }
}

// Position an overlay box outset by (xPadding, yPadding) around a feature rect.
// The top is clamped into the content edge (y >= 0) because ScrollLockedOverlay
// clips at content y=0: without this, a box outset above a top-row feature
// (topPx ≈ 0) has its top border painted at y < 0 and dropped by the clip.
// Height shrinks by the clamped amount so the bottom edge stays put.
export function computeOverlayRect(
  rect: { leftPx: number; topPx: number; width: number; heightPx: number },
  extraWidth: number,
  xPadding: number,
  yPadding: number,
) {
  const outsetTop = rect.topPx - yPadding
  const top = Math.max(0, outsetTop)
  return {
    left: rect.leftPx - xPadding,
    top,
    width: rect.width + extraWidth + xPadding * 2,
    height: rect.heightPx + yPadding * 2 - (top - outsetTop),
  }
}
