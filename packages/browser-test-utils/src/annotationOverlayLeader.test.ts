/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { PayloadAnnotation } from './annotationOverlay.ts'

// A label and the arrow back to what it names are one annotation, because the
// two cannot be kept together by hand: the tail belongs at the pill's edge and
// the pill's width is only known once its text is measured in the page. Written
// as a pair of offsets, the same spacing left a short label floating clear of
// its arrow and a long one swallowing the tail — which is what "the arrows are
// no longer next to the text boxes" was, on two committed figures.
//
// So the property under test is length-independence: whatever the label says,
// the tail sits a fixed gap off the pill and the head a fixed gap off the
// target. jsdom measures nothing, so both measurements are stubbed to what a
// browser reports for the same shapes — a monospace-ish text bbox, and rects
// read back off the attributes the overlay just wrote.
const realRect = Element.prototype.getBoundingClientRect
const CHAR_WIDTH = 12
const FONT_SIZE = 20

beforeAll(() => {
  ;(SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox =
    function getBBox(this: SVGElement) {
      const n = (a: string) => Number(this.getAttribute(a) ?? 0)
      const width = this.textContent.length * CHAR_WIDTH
      // a text element's box hangs above its baseline
      return {
        x: n('x'),
        y: n('y') - FONT_SIZE,
        width,
        height: FONT_SIZE,
      } as DOMRect
    }
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { left: 0, top: 0, width: 1024, height: 768 } as DOMRect
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect
})

// The one anchor kind that arrives pre-resolved, so the target is a number this
// test chose rather than a layout jsdom cannot do.
function callout(text: string, dx: number): PayloadAnnotation {
  return {
    type: 'text',
    text,
    fontSize: FONT_SIZE,
    leader: true,
    anchor: {
      graphNode: 'peak',
      rect: { left: 500, top: 100, width: 0, height: 0 },
    },
    dx,
  }
}

function draw(items: PayloadAnnotation[]) {
  document.body.replaceChildren()
  const { unresolved } = drawAnnotationOverlay(items, ANNOTATION_OVERLAY_ID)
  const num = (el: Element, a: string) => Number(el.getAttribute(a))
  const pill = document.querySelector('rect')
  const line = document.querySelector('line')
  return {
    unresolved,
    pill: pill && {
      left: num(pill, 'x'),
      right: num(pill, 'x') + num(pill, 'width'),
      top: num(pill, 'y'),
      bottom: num(pill, 'y') + num(pill, 'height'),
    },
    // x2 is pulled back to the arrowhead's base; the tip is the head's true
    // target, which is what a reader sees the arrow point at
    line: line && {
      tailX: num(line, 'x1'),
      y: num(line, 'y1'),
      tipX:
        num(line, 'x2') +
        Math.sign(num(line, 'x2') - num(line, 'x1')) *
          8 *
          num(line, 'stroke-width'),
    },
  }
}

test('the pill hangs dx off the target and the arrow spans the gap', () => {
  const { unresolved, pill, line } = draw([callout('IGF1', 150)])
  expect(unresolved).toEqual([])
  // dx places the pill's FACING edge, so the gap is 150 whatever it says
  expect(pill!.left).toBe(650)
  // and the label is centred on what it names rather than sat on its baseline
  expect((pill!.top + pill!.bottom) / 2).toBe(100)
  expect(line!.tailX).toBe(645)
  expect(line!.tipX).toBe(514)
  expect(line!.y).toBe(100)
})

// The regression itself: three callouts on one lane whose labels are different
// lengths used to be three different gaps, one of them negative.
test('a longer label keeps the same gap at both ends', () => {
  const short = draw([callout('LCT', 150)])
  const long = draw([callout('IGF2BP2 and then some', 150)])
  expect(long.pill!.left).toBe(short.pill!.left)
  expect(long.pill!.right).toBeGreaterThan(short.pill!.right)
  expect(long.line).toEqual(short.line)
})

test('a negative dx hangs the pill on the other side, tail on its right edge', () => {
  const { pill, line } = draw([callout('IGF2BP2', -150)])
  expect(pill!.right).toBe(350)
  expect(line!.tailX).toBe(355)
  expect(line!.tipX).toBe(486)
})

// A leader whose pill covers its target draws no arrow, and a pill with an arrow
// missing is exactly the failure a committed PNG reports and nothing else does.
test('a label sitting on what it names is a reported miss', () => {
  const { unresolved, line } = draw([callout('IGF1', 10)])
  expect(line).toBeNull()
  expect(unresolved).toHaveLength(1)
  expect(unresolved[0]).toMatch(/raise dx/)
})

test('a leader with nothing to point at is a reported miss', () => {
  document.body.replaceChildren()
  const { unresolved } = drawAnnotationOverlay(
    [{ type: 'text', text: 'IGF1', leader: true, x: 100, y: 100 }],
    ANNOTATION_OVERLAY_ID,
  )
  expect(unresolved).toHaveLength(1)
  expect(unresolved[0]).toMatch(/needs an anchor/)
})
