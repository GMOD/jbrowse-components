// Map a screen-Y to the stacked group section it falls in, returning the
// section and the screen-px top of its coverage band. Grouped mode stacks one
// section per group; ungrouped is the single-section case that spans the whole
// canvas, so this returns the only section for every Y and the hit test reduces
// to the pre-grouping single-offset path.
//
// Generic over the section shape so callers keep their full section type (the
// loop only needs `coverageTop`); pure so it can be unit-tested without a model.
export function findSectionAtY<T extends { coverageTop: number }>(
  sections: T[],
  canvasY: number,
  opts: { isGrouped: boolean; scrollTop: number; contentHeight: number },
): { section: T; coverageTopOffset: number } | undefined {
  const first = sections[0]
  if (!first) {
    return undefined
  }
  if (!opts.isGrouped) {
    return { section: first, coverageTopOffset: 0 }
  }
  const { scrollTop, contentHeight } = opts
  for (let i = 0; i < sections.length; i++) {
    const top = sections[i]!.coverageTop - scrollTop
    const next = sections[i + 1]
    const bottom = (next ? next.coverageTop : contentHeight) - scrollTop
    if (canvasY >= top && canvasY < bottom) {
      return { section: sections[i]!, coverageTopOffset: top }
    }
  }
  return undefined
}
