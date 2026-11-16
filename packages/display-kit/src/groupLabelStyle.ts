/**
 * The section-label chip is drawn twice, as an interactive HTML overlay on
 * screen and as a static SVG twin on export, so both read these constants and
 * the same label fallback.
 */
export const GROUP_LABEL_FONT_SIZE = 11
export const GROUP_LABEL_FONT_WEIGHT = 500
export const GROUP_LABEL_PADDING_X = 7
export const GROUP_LABEL_RADIUS = 8

// The pill is the paper color under a wash of the text color at this alpha,
// on both paths, so it reads the same over light and dark themes.
export const GROUP_LABEL_TINT = 0.1

export const GROUP_LABEL_ICON_SIZE = 14

// Left inset of the chip row from the content edge, on both paths.
export const GROUP_LABEL_INSET_X = 4

/**
 * Vertical space one chip occupies, and so the least a labelled section can
 * be: a chip is anchored at its section's top, and sections shorter than this
 * stack their chips on top of each other.
 */
export const GROUP_LABEL_HEIGHT = 16

/**
 * The gap above each section where the host draws no chips (the circle's
 * rings), so two sections' rows still part.
 */
export const CHIPLESS_SECTION_GAP_PX = 4

/**
 * The list key for a section; the ungrouped section's key is '', so its
 * stable spelling lives here once.
 */
export function sectionKey(groupKey: string) {
  return groupKey === '' ? 'ungrouped' : groupKey
}

/**
 * The name shown on a section's chip. A real grouped section always carries a
 * non-empty label, so this only falls back for the degenerate empty case.
 */
export function groupSectionLabel(label: string) {
  return label || 'ungrouped'
}

/**
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

/**
 * Where each section's chip draws (`groupChipTop`), thinned where sections
 * are shorter than a chip: every nth from the topmost on screen, which carries
 * the stack's own controls, so each chip spans the n sections it stands for.
 * A last run too short to hold a chip draws none, its sections falling under
 * the chip above.
 */
export function groupChipTops(
  sections: readonly { top: number; height: number }[],
  canvasHeight: number,
) {
  const shortest = Math.min(...sections.map(s => s.height))
  const stride =
    shortest >= GROUP_LABEL_HEIGHT
      ? 1
      : shortest > 0
        ? Math.ceil(GROUP_LABEL_HEIGHT / shortest)
        : sections.length
  const topmost = sections.findIndex(
    s => groupChipTop(s.top, s.height, canvasHeight) !== undefined,
  )
  return sections.map((section, i) => {
    const span = sections
      .slice(i, i + stride)
      .reduce((sum, s) => sum + s.height, 0)
    return topmost >= 0 &&
      i >= topmost &&
      (i - topmost) % stride === 0 &&
      (i === topmost || span >= GROUP_LABEL_HEIGHT)
      ? groupChipTop(
          section.top,
          Math.max(span, GROUP_LABEL_HEIGHT),
          canvasHeight,
        )
      : undefined
  })
}
