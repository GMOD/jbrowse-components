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

// Drives the hook against a real DOM canvas so the browser-latching guard and
// the scroll latch are exercised end-to-end, not just in isolation. The commit
// updates a ref (the model stand-in), so the next frame re-syncs off it.
function Harness({ onScroll }: { onScroll: (n: number) => void }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const scrollTopRef = useRef(0)
  useVirtualScrollWheel(canvas, (e, applyScroll) => {
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
  return <canvas ref={setCanvas} />
}

function wheel(el: Element, deltaY: number) {
  const e = new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true })
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
  const canvas = container.querySelector('canvas')!

  const e = wheel(canvas, 50)
  // preventDefault is synchronous (the latch owns it); the commit defers a frame
  expect(e.defaultPrevented).toBe(true)
  expect(onScroll).not.toHaveBeenCalled()

  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})

test('coalesces a burst of wheel events into one commit per frame', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const canvas = container.querySelector('canvas')!

  // three events before the frame's rAF fires: each preventDefaults immediately
  // (page scroll stays suppressed), but none commits yet
  const e1 = wheel(canvas, 20)
  const e2 = wheel(canvas, 20)
  const e3 = wheel(canvas, 20)
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
  const canvas = container.querySelector('canvas')!

  wheel(canvas, 250) // clamp to the 200 max in one shot
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(200)

  // another push at the boundary: no move, but still within the latch window
  const e = wheel(canvas, 50)
  expect(e.defaultPrevented).toBe(true)
})

test('once the pointer leaves, a latched wheel releases to the page', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const canvas = container.querySelector('canvas')!

  wheel(canvas, 250) // drive to the boundary, opening the latch window
  flushRaf()
  onScroll.mockClear()

  // browser keeps latching momentum events here after the pointer moved off
  mouse(canvas, 'mouseleave')
  const e = wheel(canvas, 50)
  flushRaf()

  // released: not consumed, not preventDefaulted, so it chains to the page
  expect(e.defaultPrevented).toBe(false)
  expect(onScroll).not.toHaveBeenCalled()
})

test('re-entering resumes normal panel scroll', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const canvas = container.querySelector('canvas')!

  mouse(canvas, 'mouseleave')
  wheel(canvas, 50)
  flushRaf()
  expect(onScroll).not.toHaveBeenCalled()

  mouse(canvas, 'mouseenter')
  const e = wheel(canvas, 50)
  expect(e.defaultPrevented).toBe(true)
  flushRaf()
  expect(onScroll).toHaveBeenLastCalledWith(50)
})
