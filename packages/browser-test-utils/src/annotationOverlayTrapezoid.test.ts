/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { PayloadAnnotation } from './annotationOverlay.ts'

// The trapezoid is the one annotation whose geometry is not a point plus a size:
// both of its horizontal edges come from an anchor's RECT, and which pair of
// edges face each other is read off the two rects rather than declared. A
// regression there draws a bowtie or a wedge pointing the wrong way, and the
// only reader is a committed PNG.
//
// Rects are injected through the pre-resolved `graphNode` path rather than
// measured, because jsdom's getBoundingClientRect is all zeros. That path is the
// same one a real graph-node anchor takes.
function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height }
}

function draw(items: PayloadAnnotation[]) {
  document.body.replaceChildren()
  const misses = drawAnnotationOverlay(items, ANNOTATION_OVERLAY_ID)
  const poly = document.querySelector('polygon')
  const sides = [...document.querySelectorAll('line')].map(l =>
    ['x1', 'y1', 'x2', 'y2'].map(a => Number(l.getAttribute(a))),
  )
  return { misses, points: poly?.getAttribute('points'), sides }
}

test('joins the facing edges, narrow end first', () => {
  const { misses, points } = draw([
    {
      type: 'trapezoid',
      fromAnchor: {
        graphNode: 'top',
        rect: rect(0, 0, 1000, 100),
        fracX: [0.2, 0.4],
      },
      anchor: { graphNode: 'bottom', rect: rect(0, 300, 1000, 100) },
    },
  ])
  expect(misses).toEqual([])
  // top rect's BOTTOM edge (y=100) over its fracX span, then the bottom rect's
  // TOP edge (y=300) over its whole width. Wound so the polygon does not cross
  // itself: left, right, right, left.
  expect(points).toBe('200,100 400,100 1000,300 0,300')
})

test('reads the direction off the rects rather than the order', () => {
  const { points } = draw([
    {
      type: 'trapezoid',
      // the narrow end is now BELOW the wide one, same annotation otherwise
      fromAnchor: {
        graphNode: 'bottom',
        rect: rect(0, 300, 1000, 100),
        fracX: [0.2, 0.4],
      },
      anchor: { graphNode: 'top', rect: rect(0, 0, 1000, 100) },
    },
  ])
  // now it is the narrow end's TOP edge (y=300) and the wide end's BOTTOM
  // (y=100), so the wedge still points at the panel and does not cross the one
  // it comes from
  expect(points).toBe('200,300 400,300 1000,100 0,100')
})

test('a fracX-less anchor spans its whole rect', () => {
  const { points } = draw([
    {
      type: 'trapezoid',
      fromAnchor: { graphNode: 'top', rect: rect(50, 0, 200, 10) },
      anchor: { graphNode: 'bottom', rect: rect(0, 100, 1000, 10) },
    },
  ])
  expect(points).toBe('50,10 250,10 1000,100 0,100')
})

// Only the slanted sides are stroked; the horizontal edges belong to the two
// panels and a line along one reads as a border the figure grew.
test('strokes two sides, not four', () => {
  const { sides } = draw([
    {
      type: 'trapezoid',
      fromAnchor: {
        graphNode: 'top',
        rect: rect(0, 0, 1000, 100),
        fracX: [0.2, 0.4],
      },
      anchor: { graphNode: 'bottom', rect: rect(0, 300, 1000, 100) },
    },
  ])
  expect(sides).toEqual([
    [200, 100, 0, 300],
    [400, 100, 1000, 300],
  ])
})

// A wedge with one end is not a shape, and the caller turns misses into a thrown
// error — the alternative is a silently undrawn lineage indicator in a committed
// figure.
test('one end is a reported miss, not a no-op', () => {
  const { misses, points } = draw([
    {
      type: 'trapezoid',
      anchor: { graphNode: 'bottom', rect: rect(0, 300, 1000, 100) },
    },
  ])
  expect(points).toBeUndefined()
  expect(misses).toHaveLength(1)
  expect(misses[0]).toMatch(/needs both anchor and fromAnchor/)
})
