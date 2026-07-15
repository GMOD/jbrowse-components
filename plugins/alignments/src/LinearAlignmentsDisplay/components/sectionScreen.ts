// The pileup has a two-tier vertical scroll model, and nearly every overlay has
// to project a content-space Y into screen space under it. Centralizing the two
// tiers here keeps each overlay from re-deriving `isGrouped ? y - scroll : y`
// inline and crossing the tiers (the off-by-a-scroll bugs all live there).
//
//   - Ungrouped: the coverage band — and the arc/sashimi bands and their resize
//     handles — is sticky at the top; only the pileup *content* scrolls beneath
//     it. So a band top ignores scrollTop, while a pileup row subtracts it.
//   - Grouped: each section scrolls as one unit, bands included, so a band top
//     scrolls exactly like the rows below it.
//
// `bandScreenTop` projects the sticky-capable tier (coverage/arc/sashimi band
// tops, and a section's pileup-clip ceiling, which clips identically).
// `contentScreenY` projects the always-scrolling tier (pileup rows, pileup band
// bottom). The renderer's device-clip equivalent is `buildSectionRenders` in
// sectionLayout.ts — keep the two in step.
export interface ScrollModel {
  isGrouped: boolean
  scrollTop: number
  canvasHeight: number
}

// Assemble a ScrollModel from a section list. Grouping is "more than one
// section" (mirrors the model's `isGrouped`), so this is the one place that
// rule is spelled for the pure label/highlight passes that don't hold a model.
export function makeScroll(
  sectionCount: number,
  scrollTop: number,
  canvasHeight: number,
): ScrollModel {
  return { isGrouped: sectionCount > 1, scrollTop, canvasHeight }
}

// Project a genomic bp to a screen-x within one visible region, honoring
// reverse-strand regions. Single source for the label/highlight overlays so the
// reversed-edge arithmetic can't drift between them (the hit-test path runs the
// inverse and stays separate). Pure; the region only needs its bp edges and
// screen offset.
export interface BpScreenRegion {
  start: number
  end: number
  reversed?: boolean
  screenStartPx: number
}
export function makeBpToPx(region: BpScreenRegion, bpPerPx: number) {
  const reversed = region.reversed ?? false
  const bpEdge = reversed ? region.end : region.start
  return (bp: number) =>
    (reversed ? bpEdge - bp : bp - bpEdge) / bpPerPx + region.screenStartPx
}

// React-list key for a section. The ungrouped section's `groupKey` is '', so
// spell its stable sentinel here once — the label / axis / resize-handle lists
// that map over sections can't then disagree on what ungrouped's key is.
export function sectionKey(groupKey: string) {
  return groupKey === '' ? 'ungrouped' : groupKey
}

// Screen Y of a sticky-capable band top (coverage / arcs / sashimi), or of a
// section's pileup-clip ceiling. Sticky (unscrolled) when ungrouped; scrolls
// with its section when grouped.
export function bandScreenTop(contentTop: number, m: ScrollModel) {
  return contentTop - (m.isGrouped ? m.scrollTop : 0)
}

// Screen Y of always-scrolling pileup content (a row, the pileup band bottom).
// The pileup scrolls in both modes — ungrouped scrolls it under sticky coverage.
export function contentScreenY(contentY: number, m: ScrollModel) {
  return contentY - m.scrollTop
}

// Whether a screen-space band [top, top+height] intersects the canvas.
export function bandOnScreen(top: number, height: number, m: ScrollModel) {
  return top + height >= 0 && top <= m.canvasHeight
}

// Screen Y of a stacked section's pileup band bottom, clamped to the canvas.
// Collapsed groups have pileupHeight 0, so this collapses to the band top and
// nothing in the band stays visible. Shared by the label / highlight / bezier
// overlays so each clips rows to its own section instead of bleeding past it.
export function sectionBandBottom(
  pileupTop: number,
  pileupHeight: number,
  m: ScrollModel,
) {
  return Math.min(m.canvasHeight, contentScreenY(pileupTop + pileupHeight, m))
}
