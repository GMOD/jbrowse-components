import { polarToCartesian } from '@jbrowse/core/util'

import { stripPerRingPx } from './ringHost.ts'

import type { Ring } from './ringHost.ts'
import type { FloatingLabel } from '@jbrowse/display-kit/floatingLabelHost'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'

/** Below this many css px a ring's label is not drawn: it would not read. */
export const MIN_RING_LABEL_PX = 6

/** css px left between two labels on one line of a ring */
const RING_LABEL_GAP_PX = 3

/**
 * Where a strip point lands on its ring, in the unrotated figure: the turn
 * from strip x = 0, as `ringHit` reads it back, and the radius its row is
 * warped to.
 */
export function stripPointToPolar(
  ring: Ring,
  x: number,
  y: number,
  stripRadiusPx: number,
) {
  return {
    radians: x / stripRadiusPx,
    radiusPx: ring.outerPx - y / stripPerRingPx(ring),
  }
}

/**
 * The annular sector a strip rect covers on its ring, clamped to the band, as
 * an SVG path in the unrotated figure; undefined for a rect off the band.
 */
export function stripRectToSectorPath(
  ring: Ring,
  rect: HighlightRect,
  stripRadiusPx: number,
) {
  const scale = stripPerRingPx(ring)
  const outer = Math.min(ring.outerPx, ring.outerPx - rect.top / scale)
  const inner = Math.max(
    ring.innerPx,
    ring.outerPx - (rect.top + rect.height) / scale,
  )
  const start = rect.left / stripRadiusPx
  const end = (rect.left + rect.width) / stripRadiusPx
  if (outer <= inner || end <= start) {
    return undefined
  }
  const largeArc = end - start > Math.PI ? 1 : 0
  return [
    'M',
    ...polarToCartesian(outer, start),
    'A',
    outer,
    outer,
    0,
    largeArc,
    1,
    ...polarToCartesian(outer, end),
    'L',
    ...polarToCartesian(inner, end),
    'A',
    inner,
    inner,
    0,
    largeArc,
    0,
    ...polarToCartesian(inner, start),
    'Z',
  ].join(' ')
}

export interface RingLabel {
  key: string
  text: string
  color: string
  fontSize: number
  /** the turn the text is centred on, in the unrotated figure */
  radians: number
  /** the turn the text spans */
  turn: number
  /** the radius of the text's middle */
  radiusPx: number
}

/**
 * A ring display's labels as the ring draws them: each curved along the arc
 * at the radius its strip line is warped to, at the font a shrunk band scales
 * it to.
 *
 * The strip spaced its labels at the strip's radius, and an inner ring gives
 * the same text more of a turn, so one can now reach over the next on its
 * line; that one is dropped rather than shrunk, as is every label of a band
 * shrunk past reading. A label never runs past the strip's end, where a ring
 * closed on itself meets its start: it is pulled back to end there, as the
 * linear view keeps one inside its region.
 */
export function ringLabels(
  ring: Ring,
  labels: readonly FloatingLabel[],
  stripRadiusPx: number,
): RingLabel[] {
  const scale = stripPerRingPx(ring)
  const lines = new Map<number, FloatingLabel[]>()
  for (const label of labels) {
    const line = lines.get(label.y)
    if (line) {
      line.push(label)
    } else {
      lines.set(label.y, [label])
    }
  }
  const kept: RingLabel[] = []
  for (const [y, line] of lines) {
    const fontSize = (line[0]?.fontSize ?? 0) / scale
    const { radiusPx } = stripPointToPolar(
      ring,
      0,
      y + (line[0]?.fontSize ?? 0) / 2,
      stripRadiusPx,
    )
    if (
      fontSize < MIN_RING_LABEL_PX ||
      radiusPx <= ring.innerPx ||
      radiusPx >= ring.outerPx
    ) {
      continue
    }
    let free = Number.NEGATIVE_INFINITY
    for (const label of line.toSorted((a, b) => a.x - b.x)) {
      const turn = label.width / scale / radiusPx
      const start = Math.min(label.x / stripRadiusPx, 2 * Math.PI - turn)
      if (start >= free) {
        kept.push({
          key: label.key,
          text: label.text,
          color: label.color,
          fontSize,
          radians: start + turn / 2,
          turn,
          radiusPx,
        })
        free = start + turn + RING_LABEL_GAP_PX / radiusPx
      }
    }
  }
  return kept
}

/**
 * The arc a label's text runs along, centred on it with room to spare, in
 * the direction that reads upright on screen: clockwise on the upper half,
 * back the other way on the lower.
 */
export function ringLabelArcPath(
  { radians, turn, radiusPx }: RingLabel,
  upsideDown: boolean,
) {
  const half = turn * 0.75
  const [from, to] = upsideDown
    ? [radians + half, radians - half]
    : [radians - half, radians + half]
  return [
    'M',
    ...polarToCartesian(radiusPx, from),
    'A',
    radiusPx,
    radiusPx,
    0,
    0,
    upsideDown ? 0 : 1,
    ...polarToCartesian(radiusPx, to),
  ].join(' ')
}
