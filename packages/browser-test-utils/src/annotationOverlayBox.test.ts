/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { PayloadAnnotation } from './annotationOverlay.ts'

// A box rings the element it names, and the ring is drawn OUTSIDE it — which
// has no room at the window edge, where a docked drawer or a pinned panel ends
// exactly at the viewport. The track-settings figure came back for it: three of
// the box's four edges were off frame and the fourth was a red line in the page
// margin. So the pad turns inward where it has to.
//
// Rects are injected through the pre-resolved `graphNode` path rather than
// measured, because jsdom's getBoundingClientRect is all zeros. jsdom's viewport
// is 1024x768.
function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height }
}

function boxAround(
  r: ReturnType<typeof rect>,
  extra: Partial<PayloadAnnotation> = {},
) {
  document.body.replaceChildren()
  drawAnnotationOverlay(
    [{ type: 'box', anchor: { graphNode: 'n', rect: r }, ...extra }],
    ANNOTATION_OVERLAY_ID,
  )
  const el = document.querySelector('rect')!
  const n = (a: string) => Number(el.getAttribute(a))
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(n)
  return { x, y, width, height, right: x! + width!, bottom: y! + height! }
}

test('rings an element with room around it from outside', () => {
  // default pad 6 on every side, so the box clears the element it names
  expect(boxAround(rect(200, 200, 100, 50))).toMatchObject({
    x: 194,
    y: 194,
    width: 112,
    height: 62,
  })
})

test('turns the pad inward at the right edge', () => {
  // a drawer ending at the viewport's right edge (1024)
  const box = boxAround(rect(824, 100, 200, 50))
  expect(box.x).toBe(818)
  // the stroke is 5 wide and centered on the path, so its outer half needs 2.5
  // inside the edge to be drawn at all
  expect(box.right).toBe(1021.5)
})

test('turns the pad inward at the top-left corner', () => {
  const box = boxAround(rect(0, 0, 300, 100))
  expect(box.x).toBe(2.5)
  expect(box.y).toBe(2.5)
  expect(box.right).toBe(306)
  expect(box.bottom).toBe(106)
})

test('turns the pad inward at the bottom edge', () => {
  const box = boxAround(rect(100, 700, 200, 68))
  expect(box.bottom).toBe(765.5)
})

// The clamp is the stroke's own half-width, so a thicker border insets further
// rather than being half-drawn.
test('insets by half of a wider stroke', () => {
  const box = boxAround(rect(824, 100, 200, 50), { strokeWidth: 12 })
  expect(box.right).toBe(1018)
})

// dx/dy move the whole box, and the clamp applies to where it lands.
test('clamps the nudged position, not the raw one', () => {
  const box = boxAround(rect(700, 100, 200, 50), { dx: 200 })
  expect(box.x).toBe(894)
  expect(box.right).toBe(1021.5)
})
