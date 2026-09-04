import { useRef, useState } from 'react'

import { act, render } from '@testing-library/react'

import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

// The hook coalesces scroll commits into requestAnimationFrame, so drive rAF
// deterministically: capture the scheduled callbacks and flush them on demand
// rather than waiting on jsdom's timer-backed rAF.
let rafCallbacks: FrameRequestCallback[] = []
const realRaf = window.requestAnimationFrame
const realCancel = window.cancelAnimationFrame

beforeEach(() => {
  rafCallbacks = []
  window.requestAnimationFrame = cb => rafCallbacks.push(cb)
  window.cancelAnimationFrame = () => {}
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
  window.cancelAnimationFrame = realCancel
})

function flushRaf() {
  const cbs = rafCallbacks
  rafCallbacks = []
  act(() => {
    for (const cb of cbs) {
      cb(0)
    }
  })
}

// Drives the hook against a real DOM panel so the browser-latching guard and
// the scroll latch are exercised end-to-end, not just in isolation. The commit
// updates a ref (the model stand-in), so the next frame re-syncs off it.
//
// The panel holds the canvas AND a clickable overlay label beside it, which is
// the shape every display using this hook has: a canvas takes no DOM children,
// so its labels/chips/arcs are positioned siblings, and the ones that answer the
// pointer are what a wheel over them targets.
function Harness({ onScroll }: { onScroll: (n: number) => void }) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const scrollTopRef = useRef(0)
  useVirtualScrollWheel(panel, (e, applyScroll) => {
    applyScroll(
      e,
      {
        scrollTop: scrollTopRef.current,
        viewportHeight: 100,
        scrollableHeight: 200,
      },
      n => {
        scrollTopRef.current = n
        onScroll(n)
      },
    )
  })
  return (
    <div data-gesture-owner="true" data-testid="layer">
      <div ref={setPanel}>
        <canvas />
        <div data-testid="label">Xkr4</div>
        <div data-gesture-owner="true" data-testid="handle">
          <span data-testid="handle-icon" />
        </div>
      </div>
    </div>
  )
}

function wheel(el: Element, deltaY: number, deltaX = 0) {
  const e = new WheelEvent('wheel', {
    deltaY,
    deltaX,
    cancelable: true,
    bubbles: true,
  })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

function mouse(el: Element, type: 'mouseenter' | 'mouseleave') {
  act(() => {
    el.dispatchEvent(new MouseEvent(type))
  })
}

test('scrolls the panel and preventDefaults while it can move', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  const e = wheel(panel, 50)
  // preventDefault is synchronous (the latch owns it); the commit defers a frame
  expect(e.defaultPrevented).toBe(true)
  expect(onScroll).not.toHaveBeenCalled()

  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})

test('coalesces a burst of wheel events into one commit per frame', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  // three events before the frame's rAF fires: each preventDefaults immediately
  // (page scroll stays suppressed), but none commits yet
  const e1 = wheel(panel, 20)
  const e2 = wheel(panel, 20)
  const e3 = wheel(panel, 20)
  expect(e1.defaultPrevented).toBe(true)
  expect(e2.defaultPrevented).toBe(true)
  expect(e3.defaultPrevented).toBe(true)
  expect(onScroll).not.toHaveBeenCalled()

  flushRaf()
  // one commit carrying the accumulated offset, not three
  expect(onScroll).toHaveBeenCalledTimes(1)
  expect(onScroll).toHaveBeenLastCalledWith(60)
})

test('at the boundary mid-gesture it latches (preventDefault, page held)', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  wheel(panel, 250) // clamp to the 200 max in one shot
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(200)

  // another push at the boundary: no move, but still within the latch window
  const e = wheel(panel, 50)
  expect(e.defaultPrevented).toBe(true)
})

test('a sideways swipe is left to the view, not consumed as scroll', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  // the vertical noise on a horizontal trackpad swipe. Consuming it would
  // preventDefault, which is how the view knows a panel took the gesture — so
  // the pan the user asked for would die on a pixel of panel drift.
  const e = wheel(panel, 2, 40)
  flushRaf()

  expect(e.defaultPrevented).toBe(false)
  expect(onScroll).not.toHaveBeenCalled()
})

test('sideways momentum stays with a panel that has already latched', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  wheel(panel, 50)
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)

  // the tail of that same gesture, where the sideways component briefly wins:
  // native latching keeps it here rather than cutting the scroll in half
  const e = wheel(panel, 2, 40)
  expect(e.defaultPrevented).toBe(true)
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(52)
})

test('once the pointer leaves, a latched wheel releases to the page', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  wheel(panel, 250) // drive to the boundary, opening the latch window
  flushRaf()
  onScroll.mockClear()

  // browser keeps latching momentum events here after the pointer moved off
  mouse(panel, 'mouseleave')
  const e = wheel(panel, 50)
  flushRaf()

  // released: not consumed, not preventDefaulted, so it chains to the page
  expect(e.defaultPrevented).toBe(false)
  expect(onScroll).not.toHaveBeenCalled()
})

test('re-entering resumes normal panel scroll', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  mouse(panel, 'mouseleave')
  wheel(panel, 50)
  flushRaf()
  expect(onScroll).not.toHaveBeenCalled()

  mouse(panel, 'mouseenter')
  const e = wheel(panel, 50)
  expect(e.defaultPrevented).toBe(true)
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})

test("a wheel over an overlay label is still the panel's scroll", () => {
  const onScroll = jest.fn()
  const { getByTestId } = render(<Harness onScroll={onScroll} />)

  // The label sits over the canvas and is clickable, so it — not the canvas —
  // is what the wheel targets. Bound to the panel, the gesture is unaffected;
  // bound to the canvas it saw nothing and the page scrolled out from under a
  // half-finished track scroll.
  const e = wheel(getByTestId('label'), 50)
  expect(e.defaultPrevented).toBe(true)

  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})

test('crossing from the canvas onto an overlay label is not leaving the panel', () => {
  const onScroll = jest.fn()
  const { container, getByTestId } = render(<Harness onScroll={onScroll} />)
  const panel = container.querySelector(
    '[data-testid="layer"]',
  )!.firstElementChild!

  wheel(panel, 50)
  flushRaf()
  onScroll.mockClear()

  // Scrolling slides a label under a stationary cursor, so the canvas takes a
  // real `mouseleave` mid-gesture. mouseenter/mouseleave ignore transitions
  // between descendants, so the panel takes none — nothing resets the latch and
  // the rest of the gesture stays the track's.
  mouse(container.querySelector('canvas')!, 'mouseleave')
  const e = wheel(getByTestId('label'), 50)
  expect(e.defaultPrevented).toBe(true)

  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(100)
})

test('a wheel inside an overlay that owns its gestures is left to it', () => {
  const onScroll = jest.fn()
  const { getByTestId } = render(<Harness onScroll={onScroll} />)

  // The panel spans its overlays now, and some of those are controls rather
  // than content — a display's own scrollbar, a band resize handle, a floating
  // legend. `closest`, because the wheel usually lands on an icon inside one.
  const e = wheel(getByTestId('handle-icon'), 50)
  expect(e.defaultPrevented).toBe(false)

  flushRaf()
  expect(onScroll).not.toHaveBeenCalled()
})

test('the marker on an ancestor of the panel disowns nothing', () => {
  const onScroll = jest.fn()
  const { getByTestId } = render(<Harness onScroll={onScroll} />)

  // TrackContainer stamps the marker once for its whole overlay layer, so
  // every panel in the tree sits under one. Walking out of the panel to find it
  // would leave a display unable to scroll at all.
  expect(getByTestId('layer').dataset.gestureOwner).toBe('true')
  const e = wheel(getByTestId('label'), 50)
  expect(e.defaultPrevented).toBe(true)

  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})
