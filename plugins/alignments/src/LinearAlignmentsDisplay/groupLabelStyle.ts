// The section-label chip is drawn twice — as an interactive HTML overlay
// (GroupLabelsOverlay) on screen and as a static SVG twin (GroupLabelBox /
// renderSvg's GroupLabelBoxes) on export — so both must look identical. These
// shared constants + the display-label fallback are the single source both read,
// so a styling/label change can't drift between the two paths.
export const GROUP_LABEL_FONT_SIZE = 11
export const GROUP_LABEL_PADDING_X = 4
export const GROUP_LABEL_RADIUS = 3
export const GROUP_LABEL_BG_OPACITY = 0.85

// The name shown on a section's label chip. A real grouped section always
// carries a non-empty label (every GROUP_BY_DIMENSIONS key generator names its
// "none" bucket), so this only falls back for the degenerate empty-label case.
export function groupSectionLabel(label: string) {
  return label || 'ungrouped'
}
