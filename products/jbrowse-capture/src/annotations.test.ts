/**
 * @jest-environment jsdom
 */
import { ANNOTATION_OVERLAY_ID } from './annotationOverlay.ts'
import { clearAnnotations, drawAnnotations } from './annotations.ts'

import type { Page } from 'puppeteer'

// evaluate and evaluateHandle run against jsdom's own document, so the
// node-side anchor resolution and the in-page overlay both execute for real
const fakePage = () =>
  ({
    evaluate: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) =>
      Promise.resolve(fn(...args)),
    evaluateHandle: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => {
      const value = fn(...args)
      return Promise.resolve({
        evaluate: (inner: (...a: unknown[]) => unknown, ...rest: unknown[]) =>
          Promise.resolve(inner(value, ...rest)),
        dispose: () => Promise.resolve(),
      })
    },
  }) as unknown as Page

function element(parent: HTMLElement, testid: string, rect: object) {
  const el = document.createElement(
    testid.includes('canvas') ? 'canvas' : 'div',
  )
  el.dataset.testid = testid
  el.getBoundingClientRect = () => rect as DOMRect
  parent.append(el)
  return el
}

const boxes = () =>
  [...document.querySelectorAll(`#${ANNOTATION_OVERLAY_ID} rect`)].map(r =>
    ['x', 'y', 'width', 'height'].map(k => Number(r.getAttribute(k))),
  )

beforeAll(() => {
  ;(globalThis as { CSS?: unknown }).CSS ??= { escape: (s: string) => s }
})

beforeEach(() => {
  document.body.replaceChildren()
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = {
    views: [],
  }
})

test('a selector anchor boxes its element, and a second draw replaces the first', async () => {
  element(document.body, 'button', {
    left: 100,
    top: 50,
    width: 40,
    height: 20,
  })
  const page = fakePage()
  const box = { type: 'box' as const, pad: 0, strokeWidth: 0 }
  await drawAnnotations(page, [
    { ...box, anchor: { selector: '[data-testid="button"]' } },
  ])
  await drawAnnotations(page, [
    { ...box, anchor: { selector: '[data-testid="button"]' } },
  ])
  expect(document.querySelectorAll(`#${ANNOTATION_OVERLAY_ID}`)).toHaveLength(1)
  expect(boxes()).toEqual([[100, 50, 40, 20]])
  await clearAnnotations(page)
  expect(document.getElementById(ANNOTATION_OVERLAY_ID)).toBeNull()
})

test('an anchor that finds nothing fails the capture by name', async () => {
  await expect(
    drawAnnotations(fakePage(), [
      { type: 'box', anchor: { selector: '[data-testid="gone"]' } },
    ]),
  ).rejects.toThrow(/resolved to nothing.*gone/)
})

test('a graph node anchor is resolved out here, against the view layout', async () => {
  element(
    element(document.body, 'view-container-g', {}),
    'graph-genome-canvas',
    { left: 10, top: 50, width: 800, height: 300 },
  )
  ;(window as unknown as { JBrowseSession: unknown }).JBrowseSession = {
    views: [
      {
        id: 'g',
        nodePositions: {
          's1+': [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
        scale: 2,
        translateX: 5,
        translateY: 7,
      },
    ],
  }
  await drawAnnotations(fakePage(), [
    {
      type: 'box',
      anchor: { graphNode: 's1' },
      pad: 0,
      strokeWidth: 0,
    },
  ])
  expect(boxes()).toEqual([[15, 57, 200, 0]])
})
