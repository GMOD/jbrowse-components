// Map a screen-Y to the stacked group section it falls in, returning the
// section and the screen-px top of its coverage band. Grouped mode stacks one
// section per group; ungrouped is the single-section case that spans the whole
// canvas, so this returns the only section for every Y and the hit test reduces
// to the pre-grouping single-offset path.
//
// Generic over the section shape so callers keep their full section type (the
// loop only needs each section's top and the strip it owns); pure so it can be
// unit-tested without a model.
export function findSectionAtY<
  T extends { coverageTop: number; height: number },
>(
  sections: T[],
  canvasY: number,
  opts: { isGrouped: boolean; scrollTop: number },
): { section: T; index: number; coverageTopOffset: number } | undefined {
  const first = sections[0]
  if (!first) {
    return undefined
  }
  if (!opts.isGrouped) {
    return { section: first, index: 0, coverageTopOffset: 0 }
  }
  const { scrollTop } = opts
  for (const [index, section] of sections.entries()) {
    const top = section.coverageTop - scrollTop
    if (canvasY >= top && canvasY < top + section.height) {
      return { section, index, coverageTopOffset: top }
    }
  }
  return undefined
}
