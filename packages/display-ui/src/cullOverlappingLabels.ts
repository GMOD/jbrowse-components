export interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * The labels to keep, left to right: one survives only where the plot holds its
 * glyphs whole and no kept label's halo meets them, as ggplot2's
 * `check_overlap` leaves them. A sweep over the kept labels still reaching the
 * current left edge, so a screen of labels costs a sort and a short walk each.
 * Sorts `candidates` in place; `tieBreak` orders two starting at the same x.
 */
export function cullOverlappingLabels<T extends LabelBox>(
  candidates: T[],
  width: number,
  height: number,
  haloPx: number,
  tieBreak: (a: T, b: T) => number = () => 0,
): T[] {
  candidates.sort((a, b) => a.left - b.left || tieBreak(a, b))
  const gap = 2 * haloPx
  const kept: T[] = []
  const active: T[] = []
  for (const c of candidates) {
    if (c.left < 0 || c.right > width || c.top < 0 || c.bottom > height) {
      continue
    }
    let n = 0
    for (const a of active) {
      if (a.right + gap > c.left) {
        active[n++] = a
      }
    }
    active.length = n
    if (active.some(a => a.top - gap < c.bottom && a.bottom + gap > c.top)) {
      continue
    }
    active.push(c)
    kept.push(c)
  }
  return kept
}
