import { SimpleFeature } from '@jbrowse/core/util'
import { fireEvent, render, screen } from '@testing-library/react'

import Arcs from './Arcs.tsx'
import { arcMidX } from './arcShape.ts'
import { createTestEnvironment } from './testEnv.ts'

// The three gestures the SVG `<path>`s used to answer natively, now that the
// arcs are ink on a canvas and a hit test stands in for `pointer-events:
// stroke`. `arcHitTest.test.ts` pins WHERE the target is; this pins that a
// pointer event reaches it at all, and what the model does when it does.
const { createDisplay } = createTestEnvironment({
  thickness: 2,
  label: 'arc',
  caption: 'the caption',
})

// `useMouseTracking` coalesces to one measurement per animation frame, so
// nothing is hit-tested until a frame runs. Run it inline rather than waiting on
// jsdom's timer: the display's own fetch autorun lands during any real wait and
// re-commits an EMPTY feature list (the harness's RPC answers `features: []`),
// so a test that sleeps is hit-testing an arc that is no longer there.
beforeEach(() => {
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
})

afterEach(() => {
  jest.restoreAllMocks()
})

function renderOneArc() {
  const { display, session } = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 100,
      end: 2000,
      score: 10,
    }),
  ])
  render(<Arcs model={display} />)
  const { shape } = display.laidOutArcs[0]!
  return {
    box: screen.getByTestId('arcs'),
    display,
    session,
    // the apex, which is on the ink
    apex: {
      x: arcMidX(shape),
      y: 0.75 * (shape.kind === 'bezier' ? shape.height : 0),
    },
  }
}

function pointAt(box: HTMLElement, { x, y }: { x: number; y: number }) {
  // jsdom reports a zero rect for every element, so the client point and the
  // container-relative one are the same numbers here.
  fireEvent.mouseMove(box, { clientX: x, clientY: y })
}

test('the pointer on an arc publishes it as the hover, and off it clears', () => {
  const { box, display, apex } = renderOneArc()
  expect(display.hoveredFeature).toBeUndefined()

  pointAt(box, apex)
  expect(display.hoveredFeature?.id()).toBe('f1')

  pointAt(box, { x: apex.x, y: apex.y - 40 })
  expect(display.hoveredFeature).toBeUndefined()
})

test('leaving the display drops the hover', () => {
  const { box, display, apex } = renderOneArc()
  pointAt(box, apex)
  expect(display.hoveredFeature?.id()).toBe('f1')

  fireEvent.mouseLeave(box)
  expect(display.hoveredFeature).toBeUndefined()
})

test('the hovered arc shows its caption', async () => {
  const { box, apex } = renderOneArc()
  pointAt(box, apex)
  expect(await screen.findByText('the caption')).toBeTruthy()
})

test('a click on an arc opens it; a click on empty band does not', () => {
  const { box, display, apex } = renderOneArc()
  const opened = jest.spyOn(display, 'selectFeature')

  // The click reads the hover the move handler already resolved, so a click
  // with nothing under the cursor has nothing to open — which is what an SVG
  // stroke miss did too.
  fireEvent.click(box)
  expect(opened).not.toHaveBeenCalled()

  pointAt(box, apex)
  fireEvent.click(box)
  expect(opened.mock.calls.map(c => c[0].id())).toEqual(['f1'])
})

test('a selected arc is drawn red, and stays red under the cursor', () => {
  const { display, session, box, apex } = renderOneArc()
  session.setSelection(display.features![0]!)
  expect(display.selectedFeatureId).toBe('f1')
  expect(display.laidOutArcs[0]!.selected).toBe(true)

  // the precedence itself is `drawArcs.test.ts`'; what this adds is that the
  // flag survives a hover, which is where the SVG version had its ternary
  pointAt(box, apex)
  expect(display.laidOutArcs[0]!.selected).toBe(true)
})
