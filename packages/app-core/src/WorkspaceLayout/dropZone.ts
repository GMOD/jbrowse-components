/**
 * Where a pointer sitting over a panel would drop a view.
 *
 * Kept as geometry over a plain rect rather than reading the DOM, because this
 * is the part of drag-and-drop with actual decisions in it — the edge band, the
 * tie-break between two edges, what happens in the middle — and all of it is
 * checkable without rendering anything or synthesising a pointer.
 */

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * `center` means "add as a tab in this panel"; an edge means "split this panel
 * and put the view in the new half".
 *
 * The bands are proportional rather than a fixed pixel depth so a narrow panel
 * stays droppable — at a fixed 40px a 100px-wide panel would be all edge and
 * have no centre to drop a tab into. `edgeFraction` is capped below 0.5 for the
 * same reason: at 0.5 the centre vanishes entirely.
 *
 * Corners go to whichever edge the pointer is proportionally deeper into, so
 * the diagonal is the tie-break and neither axis silently wins.
 */
export function dropZoneAt(
  rect: Rect,
  x: number,
  y: number,
  edgeFraction = 0.25,
): DropZone {
  const fraction = Math.min(Math.max(edgeFraction, 0), 0.49)
  if (rect.width <= 0 || rect.height <= 0) {
    return 'center'
  }
  // 0 at the left/top edge, 1 at the right/bottom
  const px = (x - rect.left) / rect.width
  const py = (y - rect.top) / rect.height

  // how far into an edge band the pointer is, as a share of that band
  const depths = [
    { zone: 'left' as const, depth: (fraction - px) / fraction },
    { zone: 'right' as const, depth: (px - (1 - fraction)) / fraction },
    { zone: 'top' as const, depth: (fraction - py) / fraction },
    { zone: 'bottom' as const, depth: (py - (1 - fraction)) / fraction },
  ].filter(candidate => candidate.depth > 0)

  if (depths.length === 0) {
    return 'center'
  }
  return depths.reduce((best, candidate) =>
    candidate.depth > best.depth ? candidate : best,
  ).zone
}

/**
 * The split a drop on `zone` asks for: which way the panel divides, and whether
 * the new half goes first. `center` is not a split.
 */
export function splitForZone(zone: DropZone) {
  switch (zone) {
    case 'left':
      return { direction: 'row' as const, before: true }
    case 'right':
      return { direction: 'row' as const, before: false }
    case 'top':
      return { direction: 'column' as const, before: true }
    case 'bottom':
      return { direction: 'column' as const, before: false }
    default:
      return undefined
  }
}

/** Where the drop indicator goes, as CSS percentages of the panel. */
export function indicatorRect(zone: DropZone) {
  switch (zone) {
    case 'left':
      return { left: '0%', top: '0%', width: '50%', height: '100%' }
    case 'right':
      return { left: '50%', top: '0%', width: '50%', height: '100%' }
    case 'top':
      return { left: '0%', top: '0%', width: '100%', height: '50%' }
    case 'bottom':
      return { left: '0%', top: '50%', width: '100%', height: '50%' }
    default:
      return { left: '0%', top: '0%', width: '100%', height: '100%' }
  }
}
