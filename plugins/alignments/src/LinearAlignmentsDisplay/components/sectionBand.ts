// Screen-y of a stacked section's pileup band bottom, clamped to the canvas.
// `topOffset` is the band's pre-scroll top; collapsed groups have pileupHeight
// 0, so this collapses to the band top and nothing in the band stays visible.
// Shared by the label and highlight overlays so both clip rows to the section
// they belong to instead of bleeding into the section below.
export function sectionBandBottom(
  topOffset: number,
  pileupHeight: number,
  scrollTop: number,
  canvasHeight: number,
) {
  return Math.min(canvasHeight, topOffset - scrollTop + pileupHeight)
}
