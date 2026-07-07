import { useRef, useState } from 'react'

import { act, render } from '@testing-library/react'

import { useVirtualScrollWheel } from './useVirtualScrollWheel.ts'

// Drives the hook against a real DOM canvas so the browser-latching guard and
// the scroll latch are exercised end-to-end, not just in isolation.
function Harness({ onScroll }: { onScroll: (n: number) => void }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const scrollTopRef = useRef(0)
  useVirtualScrollWheel(canvas, (e, applyScroll) => {
    const next = applyScroll(e, {
      scrollTop: scrollTopRef.current,
      viewportHeight: 100,
      scrollableHeight: 200,
    })
    if (next !== null) {
      scrollTopRef.current = next
      onScroll(next)
    }
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
  expect(onScroll).toHaveBeenLastCalledWith(50)
  expect(e.defaultPrevented).toBe(true)
})

test('at the boundary mid-gesture it latches (preventDefault, page held)', () => {
  const onScroll = jest.fn()
  const { container } = render(<Harness onScroll={onScroll} />)
  const canvas = container.querySelector('canvas')!

  wheel(canvas, 250) // clamp to the 200 max in one shot
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
  onScroll.mockClear()

  // browser keeps latching momentum events here after the pointer moved off
  mouse(canvas, 'mouseleave')
  const e = wheel(canvas, 50)

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
  expect(onScroll).not.toHaveBeenCalled()

  mouse(canvas, 'mouseenter')
  const e = wheel(canvas, 50)
  expect(onScroll).toHaveBeenLastCalledWith(50)
  expect(e.defaultPrevented).toBe(true)
})
