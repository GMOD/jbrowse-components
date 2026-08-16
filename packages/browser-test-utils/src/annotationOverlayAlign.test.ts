/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { AnnotationAnchor } from './annotationOverlay.ts'

// An arrow's two ends read their anchor the same way. They did not: `alignX` /
// `alignY` were applied to the head and dropped on the tail, which put a tail
// carrying one at the rect's centre instead. Nothing said so — the anchor
// resolved, the arrow drew, and it drew somewhere else.
//
// The rect is a whole track's, which is the shape that makes the bug loud:
// half its width is most of a viewport, and that is what
// tcga/mutations_cdh1_histology's "short vertical arrow" was off by.
const TRACK = { left: 0, top: 100, width: 1000, height: 200 }

function arrow(fromAnchor: AnnotationAnchor, anchor: AnnotationAnchor) {
  document.body.replaceChildren()
  drawAnnotationOverlay(
    [
      {
        type: 'arrow',
        fromAnchor: { ...fromAnchor, graphNode: 'n', rect: TRACK },
        anchor: { ...anchor, graphNode: 'n', rect: TRACK },
      },
    ],
    ANNOTATION_OVERLAY_ID,
  )
  const line = document.querySelector('line')!
  const n = (a: string) => Number(line.getAttribute(a))
  return { x1: n('x1'), y1: n('y1'), x2: n('x2'), y2: n('y2') }
}

test('both ends align left, so the arrow is vertical', () => {
  const { x1, x2 } = arrow(
    { alignX: 'left', dx: 400, fracY: 0 },
    { alignX: 'left', dx: 400, fracY: 0 },
  )
  expect(x1).toBe(400)
  // x2 is pulled back along the line to the arrowhead's base, which for a
  // vertical arrow moves only y — so a difference here would be the tail and
  // head sitting on different x, which is the defect
  expect(x2).toBe(400)
})

test('an unaligned tail is still the centre', () => {
  expect(arrow({ dx: 0 }, { alignX: 'left' }).x1).toBe(500)
})

test('alignY reaches the tail too', () => {
  expect(arrow({ alignY: 'bottom' }, { alignY: 'top' }).y1).toBe(300)
  expect(arrow({ alignY: 'top' }, { alignY: 'bottom' }).y1).toBe(100)
})

// The anchor's own dx shifts the rect before the align is read off it, so the
// two compose in that order at both ends.
test("the anchor's dx shifts the rect the align is read from", () => {
  expect(arrow({ alignX: 'right', dx: -50 }, { alignX: 'left' }).x1).toBe(950)
})
