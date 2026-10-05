/** Drop geometry over plain rects, so it is testable without a DOM. */

export type DropZone = 'center' | 'left' | 'right' | 'top' | 'bottom'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** `strip` is set on the tab strip, and gives a position in the tab order. */
export interface DropTarget {
  zone: DropZone
  strip?: StripDrop
}

/** A drop on the strip: the position in the tab order, and where to draw it. */
export interface StripDrop {
  /** insertion index into the target panel's tabs, as they are ordered NOW */
  index: number
  /** x of that gap, in the same space as the rects it was computed from */
  left: number
}

/**
 * `center` adds as a tab; an edge splits the panel. Bands are proportional and
 * capped below half, so a narrow panel keeps a centre. A corner goes to the
 * edge the pointer is proportionally deeper into.
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
 * The gap between tabs nearest `x`, by tab midpoint so every x has exactly one.
 * `x` is in the rects' coordinate space, whichever that is.
 */
export function stripDropAt(rects: Rect[], x: number): StripDrop {
  for (const [i, rect] of rects.entries()) {
    if (x < rect.left + rect.width / 2) {
      return { index: i, left: rect.left }
    }
  }
  const last = rects.at(-1)
  return {
    index: rects.length,
    left: last ? last.left + last.width : 0,
  }
}

// one table, so the shaded half and the half a drop lands in cannot disagree
const ZONES = {
  left: {
    split: { direction: 'row', before: true },
    rect: { left: '0%', top: '0%', width: '50%', height: '100%' },
  },
  right: {
    split: { direction: 'row', before: false },
    rect: { left: '50%', top: '0%', width: '50%', height: '100%' },
  },
  top: {
    split: { direction: 'column', before: true },
    rect: { left: '0%', top: '0%', width: '100%', height: '50%' },
  },
  bottom: {
    split: { direction: 'column', before: false },
    rect: { left: '0%', top: '50%', width: '100%', height: '50%' },
  },
  center: {
    split: undefined,
    rect: { left: '0%', top: '0%', width: '100%', height: '100%' },
  },
} as const satisfies Record<
  DropZone,
  {
    split: { direction: 'row' | 'column'; before: boolean } | undefined
    rect: Record<'left' | 'top' | 'width' | 'height', string>
  }
>

/**
 * The split a drop on `zone` asks for: which way the panel divides, and whether
 * the new half goes first. `center` is not a split.
 */
export function splitForZone(zone: DropZone) {
  return ZONES[zone].split
}

/** Where the drop indicator goes, as CSS percentages of the panel. */
export function indicatorRect(zone: DropZone) {
  return ZONES[zone].rect
}
