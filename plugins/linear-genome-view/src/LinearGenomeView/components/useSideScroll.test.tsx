import { useState } from 'react'

import {
  TrackOverlayContext,
  TrackOverlayPortal,
  FloatingLegend,
} from '@jbrowse/display-ui'
import { act, fireEvent, render } from '@testing-library/react'

import { useSideScroll } from './useSideScroll.ts'

import type { LinearGenomeViewModel } from '../index.ts'

afterEach(() => {
  jest.restoreAllMocks()
})

// What the hook calls on the view. `zoomTo` moves `bpPerPx` the way the real
// one does, since a pinch reads it back on the next frame.
function fakeView() {
  const view = {
    bpPerPx: 10,
    horizontalScroll: jest.fn(),
    zoomTo: jest.fn((bpPerPx: number) => {
      view.bpPerPx = bpPerPx
    }),
    cancelZoomAnimation: jest.fn(),
  }
  return view as unknown as LinearGenomeViewModel & {
    horizontalScroll: jest.Mock
    zoomTo: jest.Mock
  }
}

// Holds animation frames for the test to run, so each move can land in its own
// frame rather than being overwritten by the next before any frame applied it.
function heldFrames() {
  const frames: FrameRequestCallback[] = []
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    frames.push(cb)
    return frames.length
  })
  return () => {
    act(() => {
      for (const cb of frames.splice(0)) {
        cb(0)
      }
    })
  }
}

function pointer(type: string, init: PointerEventInit) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, init))
  })
}

// press, move, release. The release flushes whatever frame the move queued, so
// the scroll (if any) has landed by the time this returns.
function dragFrom(el: Element, init: PointerEventInit = {}) {
  act(() => {
    fireEvent.pointerDown(el, { button: 0, clientX: 100, ...init })
  })
  pointer('pointermove', { clientX: 60, ...init })
  pointer('pointerup', { clientX: 60, ...init })
}

// TracksContainer in miniature: the pan handler on the container, with a canvas
// stand-in and whatever chrome the test wants inside it.
function Harness({
  model,
  children,
}: {
  model: LinearGenomeViewModel
  children?: React.ReactNode
}) {
  const { pointerDown } = useSideScroll(model)
  return (
    <div onPointerDown={pointerDown}>
      <div data-testid="canvas">canvas</div>
      {children}
    </div>
  )
}

test('a drag on the track pans the view', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)

  dragFrom(getByTestId('canvas'))

  // dragged 40px left, so the view scrolls 40px right
  expect(model.horizontalScroll.mock.calls).toEqual([[40]])
})

test('a finger drag pans the view', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)

  dragFrom(getByTestId('canvas'), { pointerType: 'touch', pointerId: 7 })

  expect(model.horizontalScroll.mock.calls).toEqual([[40]])
})

// The browser cancels a touch it takes over as a vertical page scroll. The
// movement so far lands, and the pan lets go rather than staying latched onto
// every later move.
test('a cancelled touch ends the pan', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')
  const touch = { pointerType: 'touch', pointerId: 7 }

  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, ...touch })
  })
  pointer('pointermove', { clientX: 90, ...touch })
  pointer('pointercancel', { clientX: 90, ...touch })
  expect(Object.hasOwn(canvas.parentElement!.dataset, 'panDragging')).toBe(
    false,
  )
  pointer('pointermove', { clientX: 20, ...touch })

  expect(model.horizontalScroll.mock.calls).toEqual([[10]])
})

const first = { pointerType: 'touch', pointerId: 1 }
const second = { pointerType: 'touch', pointerId: 2, isPrimary: false }

function pinchFrom(canvas: Element) {
  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, ...first })
  })
  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 200, ...second })
  })
}

// Doubling the spread halves bpPerPx about the midpoint the fingers started
// from, and the midpoint moving from 150 to 200 carries that base with it.
test('spreading two fingers zooms in about their midpoint', () => {
  const runFrames = heldFrames()
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)

  pinchFrom(getByTestId('canvas'))
  pointer('pointermove', { clientX: 300, ...second })
  runFrames()

  expect(model.zoomTo.mock.calls).toEqual([[5, 150]])
  expect(model.horizontalScroll.mock.calls).toEqual([[-50]])
})

// The finger left behind measures from where it is, not from where it was
// when the pinch began, so the view does not jump when the other lifts.
test('lifting one finger of a pinch goes back to panning with the other', () => {
  const runFrames = heldFrames()
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)

  pinchFrom(getByTestId('canvas'))
  pointer('pointermove', { clientX: 300, ...second })
  pointer('pointerup', { clientX: 300, ...second })
  model.horizontalScroll.mockClear()
  pointer('pointermove', { clientX: 80, ...first })
  runFrames()
  pointer('pointerup', { clientX: 80, ...first })

  expect(model.zoomTo).toHaveBeenCalledTimes(1)
  expect(model.horizontalScroll.mock.calls).toEqual([[20]])
})

// However little the fingers travelled, the release that ends a pinch is not a
// tap on whatever is under the first finger.
test('a pinch is never a click', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')

  pinchFrom(canvas)

  expect(Object.hasOwn(canvas.parentElement!.dataset, 'panMoved')).toBe(true)
})

// A mouse has one pointer; any other pointer that is not a finger (a pen
// beside a mouse drag) is not the second half of a pinch.
test('a pointer that is not a finger does not join the pan', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')

  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100 })
  })
  act(() => {
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 300,
      pointerType: 'pen',
      pointerId: 5,
      isPrimary: false,
    })
  })
  pointer('pointermove', { clientX: 400, pointerType: 'pen', pointerId: 5 })
  pointer('pointermove', { clientX: 80 })
  pointer('pointerup', { clientX: 80 })

  expect(model.zoomTo).not.toHaveBeenCalled()
  expect(model.horizontalScroll.mock.calls).toEqual([[20]])
})

// Dragging across DOM text inside a track would otherwise select it.
test('a pan selects no text, and text is selectable again after', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const selectStart = () => {
    const event = new Event('selectstart', { cancelable: true })
    document.body.dispatchEvent(event)
    return event.defaultPrevented
  }

  act(() => {
    fireEvent.pointerDown(getByTestId('canvas'), { button: 0, clientX: 100 })
  })
  expect(selectStart()).toBe(true)
  pointer('pointerup', { clientX: 100 })
  expect(selectStart()).toBe(false)
})

// A track's own pointer handlers read the pan off the container: no hover
// while the button is down, and no click for a press that travelled. The
// moved marker outlives the release, since the click it answers for fires
// after it, and the next press clears it.
test('the container says while a pan runs, and whether the press travelled', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')
  const container = canvas.parentElement!

  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100 })
  })
  expect(Object.hasOwn(container.dataset, 'panDragging')).toBe(true)
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
  pointer('pointermove', { clientX: 98 })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
  pointer('pointermove', { clientX: 60 })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)
  pointer('pointerup', { clientX: 60 })
  expect(Object.hasOwn(container.dataset, 'panDragging')).toBe(false)
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)

  act(() => {
    fireEvent.pointerDown(canvas, { button: 0, clientX: 60 })
  })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
})

// ...and it is cleared by a press that starts NO pan, which is the half the
// test above cannot see: the next press there is an ordinary left-click on the
// canvas. A shift-press, a right-press and a press on a button all return early,
// and each used to leave the marker from the pan before it standing.
test.each([
  ['a shift-press', { button: 0, shiftKey: true }],
  ['a right-press', { button: 2 }],
])('%s clears the marker the pan before it left', (_name, press) => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')
  const container = canvas.parentElement!

  dragFrom(canvas)
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)

  act(() => {
    fireEvent.pointerDown(canvas, { clientX: 60, ...press })
  })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
})

test('a press on a button clears it too', () => {
  const model = fakeView()
  const { getByTestId } = render(
    <Harness model={model}>
      <button type="button" data-testid="chip-menu">
        menu
      </button>
    </Harness>,
  )
  const container = getByTestId('canvas').parentElement!

  dragFrom(getByTestId('canvas'))
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)

  act(() => {
    fireEvent.pointerDown(getByTestId('chip-menu'), { button: 0, clientX: 60 })
  })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
})

// The legend's own marker, on the path where it is the only thing there is:
// with no TrackOverlayContext, FloatingLegend renders inline rather than into
// the overlay node, so it is not covered by the node's marker.
test('a drag on legend text selects it instead of panning', () => {
  const model = fakeView()
  const { getByText } = render(
    <Harness model={model}>
      <FloatingLegend
        sections={[{ id: 'sv', items: [{ color: '#f00', label: 'deletion' }] }]}
      />
    </Harness>,
  )

  // the press lands on the label, a descendant of the legend box that carries
  // the marker — hence `closest`, not a check on the target itself
  dragFrom(getByText('deletion'))

  expect(model.horizontalScroll).not.toHaveBeenCalled()
})

// TrackContainer's portal target, reproduced here with the two properties this
// test is about: pointer-events:none, and the marker that covers whatever takes
// events back. A panel is portaled INTO it but is not a React child of it, so
// this is also the check that `closest` walks the real DOM (where the panel is
// inside the node) rather than the React tree (where it is not).
function OverlayNode({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  return (
    <div
      ref={setEl}
      style={{ pointerEvents: 'none' }}
      data-gesture-owner="true"
    >
      <TrackOverlayContext value={el}>{children}</TrackOverlayContext>
    </div>
  )
}

test('the overlay node covers portaled chrome that declares no marker', () => {
  const model = fakeView()
  const { getByText } = render(
    <Harness model={model}>
      <OverlayNode>
        <TrackOverlayPortal>
          {/* a panel written to TrackOverlayPortal's instructions and nothing
              more: it takes pointer events back, and says nothing about drags */}
          <div style={{ pointerEvents: 'auto' }}>Resolution: 25 kbp</div>
        </TrackOverlayPortal>
      </OverlayNode>
    </Harness>,
  )

  dragFrom(getByText('Resolution: 25 kbp'))

  expect(model.horizontalScroll).not.toHaveBeenCalled()
})
