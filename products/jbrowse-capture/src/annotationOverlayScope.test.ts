/**
 * @jest-environment jsdom
 */
import {
  ANNOTATION_OVERLAY_ID,
  drawAnnotationOverlay,
} from './annotationOverlay.ts'

import type { AnnotationAnchor } from './annotationOverlay.ts'

// A `selector` or `text` anchor with a `view` resolves inside that view's own
// container. Without the scope, the rows of a synteny stack are
// indistinguishable: every row's scalebar carries the same `refLabel-prefix`
// chip, and two rows of one assembly caption it with the same name, so
// `document.querySelector` handed every callout the first row's chip.
const realRect = Element.prototype.getBoundingClientRect

beforeAll(() => {
  // jsdom implements no CSS object; the ids here need no escaping
  ;(globalThis as unknown as { CSS: unknown }).CSS = {
    escape: (s: string) => s,
  }
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(
    this: Element,
  ) {
    // only the chips have a size; a box around a container would win the
    // text scan's smallest-area test with a zero-area rect otherwise
    const top = (this as HTMLElement).dataset.top
    return top === undefined
      ? ({ left: 0, top: 0, width: 0, height: 0 } as DOMRect)
      : ({ left: 0, top: Number(top), width: 100, height: 20 } as DOMRect)
  }
})

afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect
})

beforeEach(() => {
  document.body.innerHTML = `
    <div data-testid="view-container-synteny">
      <div data-testid="linear-genome-view-row0">
        <span data-testid="refLabel-prefix" data-top="100">hg38</span>
      </div>
      <div data-testid="linear-genome-view-row1">
        <span data-testid="refLabel-prefix" data-top="300">hg38</span>
      </div>
    </div>`
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = {
    views: [{ id: 'synteny', views: [{ id: 'row0' }, { id: 'row1' }] }],
  }
})

function boxTop(anchor: AnnotationAnchor) {
  document.getElementById(ANNOTATION_OVERLAY_ID)?.remove()
  const problems = drawAnnotationOverlay(
    [{ type: 'box', anchor, pad: 0, strokeWidth: 0 }],
    ANNOTATION_OVERLAY_ID,
  )
  const rect = document.querySelector('rect')
  return { problems, top: rect ? Number(rect.getAttribute('y')) : undefined }
}

test('a selector anchor with a view lands in that view', () => {
  const selector = '[data-testid="refLabel-prefix"]'
  expect(boxTop({ selector }).top).toBe(100)
  expect(boxTop({ selector, view: [0, 0] }).top).toBe(100)
  expect(boxTop({ selector, view: [0, 1] }).top).toBe(300)
})

test('a text anchor with a view lands in that view', () => {
  expect(boxTop({ text: 'hg38' }).top).toBe(100)
  expect(boxTop({ text: 'hg38', view: [0, 1] }).top).toBe(300)
})

test('a view the session does not have is a miss, not the whole document', () => {
  const { problems } = boxTop({
    selector: '[data-testid="refLabel-prefix"]',
    view: [0, 2],
  })
  expect(problems.unresolved).toHaveLength(1)
})
