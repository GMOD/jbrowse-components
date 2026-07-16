import { alpha } from '@mui/material'

import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'

import type { FeatureLabelData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

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

export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
  showLabels = true,
  showDescriptions = true,
) {
  return Math.max(
    0,
    maxLabelTextWidth(labelData, showLabels, showDescriptions) - featureWidthPx,
  )
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
