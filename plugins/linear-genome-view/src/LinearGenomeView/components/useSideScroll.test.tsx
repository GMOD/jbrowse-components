import { useState } from 'react'

import {
  TrackOverlayContext,
  TrackOverlayPortal,
  FloatingLegend,
} from '@jbrowse/display-ui'
import { act, fireEvent, render } from '@testing-library/react'

import { useSideScroll } from './useSideScroll.ts'

import type { LinearGenomeViewModel } from '../index.ts'

// The hook only ever calls `horizontalScroll`, so the view is that one method.
function fakeView() {
  return { horizontalScroll: jest.fn() } as unknown as LinearGenomeViewModel & {
    horizontalScroll: jest.Mock
  }
}

// press, move, release. The release flushes whatever frame the move queued, so
// the scroll (if any) has landed by the time this returns.
function dragFrom(el: Element) {
  act(() => {
    fireEvent.mouseDown(el, { button: 0, clientX: 100 })
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60 }))
  })
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
  const { mouseDown, mouseUp } = useSideScroll(model)
  return (
    <div onMouseDown={mouseDown} onMouseUp={mouseUp}>
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

// A track's own pointer handlers read the pan off the container: no hover
// while the button is down, and no click for a press that travelled. The
// moved marker outlives the mouseup, since the click it answers for fires
// after it, and the next press clears it.
test('the container says while a pan runs, and whether the press travelled', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)
  const canvas = getByTestId('canvas')
  const container = canvas.parentElement!

  act(() => {
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100 })
  })
  expect(Object.hasOwn(container.dataset, 'panDragging')).toBe(true)
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 98 }))
  })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(false)
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
  })
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60 }))
  })
  expect(Object.hasOwn(container.dataset, 'panDragging')).toBe(false)
  expect(Object.hasOwn(container.dataset, 'panMoved')).toBe(true)

  act(() => {
    fireEvent.mouseDown(canvas, { button: 0, clientX: 60 })
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
    fireEvent.mouseDown(canvas, { clientX: 60, ...press })
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
    fireEvent.mouseDown(getByTestId('chip-menu'), { button: 0, clientX: 60 })
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
      <FloatingLegend items={[{ color: '#f00', label: 'deletion' }]} />
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
