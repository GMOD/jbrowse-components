import { useState } from 'react'

import { act, render } from '@testing-library/react'

import { useRowVirtualScroll } from './useRowVirtualScroll.ts'

// The hook commits scroll through requestAnimationFrame (useVirtualScrollWheel
// coalesces per frame), so drive rAF by hand rather than waiting on jsdom's
// timer-backed one. The resize half commits synchronously and needs no flush.
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

// A row-stack panel with 50 rows of 10px in a 100px viewport, so it genuinely
// scrolls (400px of extent) and the resize gesture is reachable.
const VIEWPORT = 100
const NROW = 50

function Harness({
  scrollZoom,
  onRowHeight,
  onScrollTop,
}: {
  scrollZoom: boolean
  onRowHeight: (n: number) => void
  onScrollTop: (n: number) => void
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [rowHeight, setRowHeight] = useState(10)
  const [scrollTop, setScrollTop] = useState(0)
  useRowVirtualScroll(
    el,
    {
      effectiveRowHeight: rowHeight,
      scrollTop,
      nrow: NROW,
      scrollableHeight: Math.max(0, NROW * rowHeight - VIEWPORT),
      setRowHeight: n => {
        setRowHeight(n)
        onRowHeight(n)
      },
      setScrollTop: n => {
        setScrollTop(n)
        onScrollTop(n)
      },
    },
    { viewportHeight: VIEWPORT, scrollZoom },
  )
  return <div ref={setEl} />
}

function wheel(
  el: Element,
  deltaY: number,
  mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean } = {},
) {
  const e = new WheelEvent('wheel', {
    deltaY,
    cancelable: true,
    bubbles: true,
    ...mods,
  })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

function setup(scrollZoom = false) {
  const onRowHeight = jest.fn()
  const onScrollTop = jest.fn()
  const { container } = render(
    <Harness
      scrollZoom={scrollZoom}
      onRowHeight={onRowHeight}
      onScrollTop={onScrollTop}
    />,
  )
  return { el: container.querySelector('div')!, onRowHeight, onScrollTop }
}

test('a plain wheel scrolls the rows', () => {
  const { el, onScrollTop, onRowHeight } = setup()
  expect(wheel(el, 50).defaultPrevented).toBe(true)
  flushRaf()
  expect(onScrollTop).toHaveBeenLastCalledWith(50)
  expect(onRowHeight).not.toHaveBeenCalled()
})

test('shift+wheel resizes the rows instead of scrolling them', () => {
  const { el, onRowHeight } = setup()
  expect(wheel(el, -240, { shiftKey: true }).defaultPrevented).toBe(true)
  expect(onRowHeight).toHaveBeenLastCalledWith(11)
})

test('scrollZoom hands the plain wheel to the view, keeping shift for resize', () => {
  const { el, onScrollTop, onRowHeight } = setup(true)
  expect(wheel(el, 50).defaultPrevented).toBe(false)
  flushRaf()
  expect(onScrollTop).not.toHaveBeenCalled()

  wheel(el, -240, { shiftKey: true })
  expect(onRowHeight).toHaveBeenLastCalledWith(11)
})

// ctrl/meta is browser page zoom and the view's pinch-zoom. Every other display
// passes it through; a row-stack display used to swallow it whenever shift was
// also held, because the resize branch was tested first and preventDefaults.
test.each([
  ['ctrl', { ctrlKey: true }],
  ['meta', { metaKey: true }],
])('%s+wheel falls through to the view, with or without shift', (_, mod) => {
  const { el, onScrollTop, onRowHeight } = setup()

  expect(wheel(el, 50, mod).defaultPrevented).toBe(false)
  expect(wheel(el, -240, { ...mod, shiftKey: true }).defaultPrevented).toBe(
    false,
  )
  flushRaf()
  expect(onScrollTop).not.toHaveBeenCalled()
  expect(onRowHeight).not.toHaveBeenCalled()
})
