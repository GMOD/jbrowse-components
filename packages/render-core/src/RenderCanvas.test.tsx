import { useState } from 'react'

import { fireEvent, render } from '@testing-library/react'

import RenderCanvas from './RenderCanvas.tsx'

// The reason this component exists. A backend re-init needs an element that
// never held a context: `getContext('webgl2')` hands back the same *lost*
// context, and `getContext('2d')` returns null on any element that once had
// WebGL — so reusing the element turns a recoverable loss into a permanent
// "Canvas 2D context not available". `canvasKey` is what forces a fresh one,
// and until this component it was a `key={canvasKey}` each drop-to-primitive
// consumer had to remember to write.
//
// Driven from a stable parent, NOT from RTL's `rerender()`: in this repo's setup
// `rerender()` unmounts and remounts the tree, so a key test written with it
// passes whether or not the key is there (see the note in
// SequenceFeatureDetails, and `reference-rtl-rerender-remounts`). Both
// assertions below were confirmed to fail with `key={handle.canvasKey}` removed.
function Harness({
  canvasRef,
}: {
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const [canvasKey, setCanvasKey] = useState(0)
  const [done, setDone] = useState(false)
  return (
    <>
      <button
        type="button"
        data-testid="bump-key"
        onClick={() => {
          setCanvasKey(k => k + 1)
        }}
      />
      <button
        type="button"
        data-testid="toggle-drawn"
        onClick={() => {
          setDone(d => !d)
        }}
      />
      {/* A deliberately CHANGING testid, which is this fixture's "unrelated
          prop" -- the point is that mutating one does not remount the canvas.
          The names are the fixture's own and match nothing real: no display
          spells readiness into `data-testid` any more (ADR-065), and using a
          retired `*_done` id here read as live usage to every later grep. */}
      <RenderCanvas
        handle={{ canvasRef, canvasKey }}
        drawn={done}
        phase={done ? 'ready' : 'loading'}
        data-testid={done ? 'demo_canvas_painted' : 'demo_canvas'}
      />
    </>
  )
}

function setup() {
  const canvasRef = jest.fn()
  const { container, getByTestId } = render(<Harness canvasRef={canvasRef} />)
  return {
    canvasRef,
    getByTestId,
    canvas: () => container.querySelector('canvas'),
  }
}

test('a changed canvasKey mounts a fresh element', () => {
  const { canvas, getByTestId } = setup()
  const first = canvas()
  expect(first).not.toBeNull()

  fireEvent.click(getByTestId('bump-key'))
  expect(canvas()).not.toBe(first)
})

test('an unrelated prop change keeps the live element', () => {
  const { canvas, getByTestId } = setup()
  const first = canvas()

  // A remount here would drop a live GPU context and re-run the whole backend
  // factory for a changed attribute, so "the key is the *only* thing that
  // remounts" is half the invariant.
  fireEvent.click(getByTestId('toggle-drawn'))
  expect(canvas()).toBe(first)
  expect(canvas()?.dataset.testid).toBe('demo_canvas_painted')
})

test('the hook is handed each fresh element through canvasRef', () => {
  const { canvasRef, getByTestId } = setup()
  canvasRef.mockClear()

  fireEvent.click(getByTestId('bump-key'))
  // detach of the old element, then attach of the new one — the remount is only
  // useful if the hook actually learns about the replacement. First argument
  // only: React 19 passes further args to a detaching callback ref.
  expect(canvasRef.mock.calls.map(c => c[0])).toEqual([
    null,
    expect.any(HTMLCanvasElement),
  ])
})

// The testid deliberately does NOT come from this component — it is the call
// site's name for its own canvas, forwarded verbatim. There used to be a
// readiness suffix to compose here as well (`_done` for these two views against
// `DisplayChrome`'s `-done`); ADR-065 deleted both, so there is nothing left to
// centralize and the id is now stable for the element's whole life.
test('forwards data-testid verbatim rather than composing one', () => {
  const { canvas } = setup()
  expect(canvas()?.dataset.testid).toBe('demo_canvas')
})

test('emits no testid attribute when none is passed', () => {
  const { container } = render(
    <RenderCanvas
      handle={{ canvasRef: jest.fn(), canvasKey: 0 }}
      drawn
      phase="ready"
    />,
  )
  expect(container.querySelector('canvas')?.hasAttribute('data-testid')).toBe(
    false,
  )
})

test('forwards the caller half — sizing, class and handlers', () => {
  const onMouseMove = jest.fn()
  const { container } = render(
    <RenderCanvas
      handle={{ canvasRef: jest.fn(), canvasKey: 0 }}
      drawn
      phase="ready"
      className="lvl"
      style={{ width: 120, height: 40 }}
      onMouseMove={onMouseMove}
    />,
  )
  const canvas = container.querySelector('canvas')!
  expect(canvas.className).toBe('lvl')
  expect(canvas.style.width).toBe('120px')
  expect(canvas.style.height).toBe('40px')

  fireEvent.mouseMove(canvas)
  expect(onMouseMove).toHaveBeenCalled()
})

// The gap this closed: `PENDING_DISPLAYS` used to name `synteny_canvas`
// explicitly and forgot dotplot, so an unpainted dotplot counted as finished and
// a capture could land on it blank. Publishing the same attribute the LGV chrome
// does makes "has everything painted?" one selector that covers every view.
test('publishes the paint state the readiness waits select on', () => {
  const { canvas, getByTestId } = setup()
  expect(canvas()?.dataset.displayDrawn).toBe('false')

  fireEvent.click(getByTestId('toggle-drawn'))
  expect(canvas()?.dataset.displayDrawn).toBe('true')
})

// The half a shared canvas could not answer before: `drawn` is finished content
// and `phase` is still-working, and every DOM-level doneness wait keys on the
// second. A view that published only the first turned `waitForDisplayPhases`
// and the busy selector into assertions about an absent element.
test('publishes the phase beside the paint flag', () => {
  const { container } = render(
    <RenderCanvas
      handle={{ canvasRef: jest.fn(), canvasKey: 0 }}
      drawn={false}
      phase="loading"
    />,
  )
  const canvas = container.querySelector('canvas')!
  expect(canvas.dataset.displayDrawn).toBe('false')
  expect(canvas.dataset.displayPhase).toBe('loading')
})
