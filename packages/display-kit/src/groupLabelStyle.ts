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

// Whether a section shorter than a chip has a section at least a chip tall
// starting under where its chip would sit, which takes the chip instead.
function yieldsChip(
  sections: readonly { top: number; height: number }[],
  index: number,
) {
  const { top, height } = sections[index]!
  let found = false
  if (height < GROUP_LABEL_HEIGHT) {
    for (
      let j = index + 1;
      !found &&
      j < sections.length &&
      sections[j]!.top < top + GROUP_LABEL_HEIGHT;
      j++
    ) {
      found = sections[j]!.height >= GROUP_LABEL_HEIGHT
    }
  }
  return found
}

/**
 * Where each section's chip draws (`groupChipTop`), thinned by position so
 * chips never overlap: walking down from the topmost section on screen, which
 * carries the stack's own controls, a section gets a chip when its top is a
 * chip's height below the last chip drawn. A section shorter than a chip
 * yields to a section at least a chip tall that starts under it, so a short
 * or empty section never takes a tall one's chip. A chip on a short section
 * sits at its top and covers the sections it stands for.
 */
export function groupChipTops(
  sections: readonly { top: number; height: number }[],
  canvasHeight: number,
) {
  let lastChipTop = Number.NEGATIVE_INFINITY
  return sections.map((section, i) => {
    const chipTop =
      !yieldsChip(sections, i) &&
      section.top >= lastChipTop + GROUP_LABEL_HEIGHT &&
      groupChipTop(section.top, section.height, canvasHeight) !== undefined
        ? groupChipTop(
            section.top,
            Math.max(section.height, GROUP_LABEL_HEIGHT),
            canvasHeight,
          )
        : undefined
    lastChipTop = chipTop ?? lastChipTop
    return chipTop
  })
}
