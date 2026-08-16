/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { PayloadAnnotation } from './annotationOverlay.ts'

// A callout whose anchor resolves and which then draws outside the capture is
// invisible in the PNG and reported by nothing else — the anchor resolved, so
// the miss list stays empty and the figure ships without it.
//
// jsdom measures every element as a zero rect, which is exactly the state the
// overlay reads as "no layout here" and skips the check on. So these tests give
// it a layout: getBoundingClientRect derives from the attributes the overlay
// just wrote, which is what a browser would report for the same shapes. jsdom's
// viewport is 1024x768.
const realRect = Element.prototype.getBoundingClientRect

function toRect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(
    this: Element,
  ) {
    const n = (a: string) => Number(this.getAttribute(a) ?? 0)
    switch (this.tagName) {
      case 'svg': {
        return toRect(0, 0, window.innerWidth, window.innerHeight)
      }
      case 'circle': {
        const r = n('r')
        return toRect(n('cx') - r, n('cy') - r, r * 2, r * 2)
      }
      case 'rect': {
        return toRect(n('x'), n('y'), n('width'), n('height'))
      }
      case 'line': {
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(n) as [
          number,
          number,
          number,
          number,
        ]
        return toRect(
          Math.min(x1, x2),
          Math.min(y1, y2),
          Math.abs(x2 - x1),
          Math.abs(y2 - y1),
        )
      }
      default: {
        return toRect(0, 0, 0, 0)
      }
    }
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect
})

function draw(items: PayloadAnnotation[]) {
  document.body.replaceChildren()
  return drawAnnotationOverlay(items, ANNOTATION_OVERLAY_ID)
}

// a ring is anchored at a point and, unlike a box, is not clamped into frame
function ringAt(left: number, top: number): PayloadAnnotation {
  return {
    type: 'circle',
    anchor: { graphNode: 'n', rect: { left, top, width: 20, height: 20 } },
  }
}

test('says nothing about a callout inside the frame', () => {
  const { unresolved, offFrame } = draw([ringAt(400, 300)])
  expect(unresolved).toEqual([])
  expect(offFrame).toEqual([])
})

test('reports a ring drawn past the right edge', () => {
  const { unresolved, offFrame } = draw([ringAt(1400, 300)])
  // the anchor RESOLVED — this is the case the miss list cannot see
  expect(unresolved).toEqual([])
  expect(offFrame).toHaveLength(1)
  expect(JSON.parse(offFrame.join(''))).toMatchObject({
    type: 'circle',
    viewport: { width: 1024, height: 768 },
  })
})

test('reports a ring drawn above the frame', () => {
  expect(draw([ringAt(400, -500)]).offFrame).toHaveLength(1)
})

test('reports only the callout that left the frame', () => {
  const { offFrame } = draw([ringAt(400, 300), ringAt(-900, 300)])
  expect(offFrame).toHaveLength(1)
  expect(JSON.parse(offFrame.join('')).drawn.right).toBeLessThan(0)
})

// A perfectly vertical arrow has a zero-WIDTH bounding box, and a zero-width box
// is not an off-frame one. Read as an area, it has none, so an arrow sitting in
// the middle of the frame reported as invisible and failed its whole figure —
// which is what stopped multiway_synteny/wheat_homoeolog_selection from
// rendering. What is being asked is whether the drawn box INTERSECTS the
// viewport, and a degenerate box can.
test('says nothing about a vertical arrow in the middle of the frame', () => {
  const { unresolved, offFrame } = draw([
    {
      type: 'arrow',
      from: { x: 500, y: 400 },
      anchor: {
        graphNode: 'n',
        rect: { left: 500, top: 200, width: 0, height: 0 },
      },
    },
  ])
  expect(unresolved).toEqual([])
  expect(offFrame).toEqual([])
})

test('a vertical arrow that is genuinely off frame still reports', () => {
  const { offFrame } = draw([
    {
      type: 'arrow',
      from: { x: 1500, y: 400 },
      anchor: {
        graphNode: 'n',
        rect: { left: 1500, top: 200, width: 0, height: 0 },
      },
    },
  ])
  expect(offFrame).toHaveLength(1)
})

// The clamp that keeps a box's stroke inside the frame is what makes a partial
// clip deliberate rather than a bug, so an element flush against the edge must
// not report — this is the case a "mostly visible" threshold would fire on.
test('says nothing about a box clamped to the frame edge', () => {
  const { offFrame } = draw([
    {
      type: 'box',
      anchor: {
        graphNode: 'n',
        rect: { left: 824, top: 100, width: 200, height: 50 },
      },
    },
  ])
  expect(offFrame).toEqual([])
})
