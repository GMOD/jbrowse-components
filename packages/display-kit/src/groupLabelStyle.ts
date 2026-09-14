/**
 * #api display-kit
 * The section-label chip is drawn twice, as an interactive HTML overlay on
 * screen and as a static SVG twin on export, so both read these constants and
 * the same label fallback.
 */
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

/**
 * #api display-kit
 * Vertical space one chip occupies, and so the least a labelled section can
 * be: a chip is anchored at its section's top, and sections shorter than this
 * stack their chips on top of each other.
 */
export const GROUP_LABEL_HEIGHT = 16

/**
 * #api display-kit
 * The name shown on a section's chip. A real grouped section always carries a
 * non-empty label, so this only falls back for the degenerate empty case.
 */
export function groupSectionLabel(label: string) {
  return label || 'ungrouped'
}

/**
 * #api display-kit
 * Where a section's chip draws, in screen px, or `undefined` when the section
 * is off screen. The chip is pinned to the top of the canvas while its section
 * scrolls past and released on the section's own bottom edge; pin first,
 * release second, or the release floors at 0 and the chip never yields.
 */
export function groupChipTop(
  sectionTop: number,
  sectionHeight: number,
  canvasHeight: number,
) {
  return sectionTop + sectionHeight >= 0 && sectionTop <= canvasHeight
    ? Math.min(
        Math.max(0, sectionTop),
        sectionTop + sectionHeight - GROUP_LABEL_HEIGHT,
      )
    : undefined
}
