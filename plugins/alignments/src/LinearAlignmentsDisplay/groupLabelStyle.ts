import { bandOnScreen } from './components/sectionScreen.ts'

import type { ScrollModel } from './components/sectionScreen.ts'

// The section-label chip is drawn twice — as an interactive HTML overlay
// (GroupLabelsOverlay) on screen and as a static SVG twin (GroupLabelBox /
// renderSvg's GroupLabelBoxes) on export — so both must look identical. These
// shared constants + the display-label fallback are the single source both read,
// so a styling/label change can't drift between the two paths.
export const GROUP_LABEL_FONT_SIZE = 11
export const GROUP_LABEL_PADDING_X = 4
export const GROUP_LABEL_RADIUS = 3

// Applied to the background COLOUR on both paths, never as an element opacity,
// which would fade the chip's text and chevron along with the box.
export const GROUP_LABEL_BG_OPACITY = 0.85

// The chevron the on-screen chip draws before its text. Part of the chip's
// width, so the static twin reserves the same slot.
export const GROUP_LABEL_ICON_SIZE = 14

// Left inset of the chip row from the content edge, on both paths.
export const GROUP_LABEL_INSET_X = 4

// Vertical space one chip occupies. Also the minimum height of a labelled
// section (`computeStackedSections`): a chip is anchored at its section's top,
// so sections shorter than this stack their chips on top of each other and every
// label but the last becomes unreadable. Matters most for one-row-per-group
// layouts, where the pileup itself is shorter than its own label.
export const GROUP_LABEL_HEIGHT = 16

// The name shown on a section's label chip. A real grouped section always
// carries a non-empty label (every GROUP_BY_DIMENSIONS key generator names its
// "none" bucket), so this only falls back for the degenerate empty-label case.
export function groupSectionLabel(label: string) {
  return label || 'ungrouped'
}

// Where a section's chip draws, or `undefined` when the section is off screen.
// The chip is pinned to the top of the canvas while its section scrolls past and
// released on the section's own bottom edge; pin first, release second, or the
// release floors at 0 and the chip never yields.
export function groupChipTop(
  sectionTop: number,
  sectionHeight: number,
  scroll: ScrollModel,
) {
  return bandOnScreen(sectionTop, sectionHeight, scroll)
    ? Math.min(
        Math.max(0, sectionTop),
        sectionTop + sectionHeight - GROUP_LABEL_HEIGHT,
      )
    : undefined
}
