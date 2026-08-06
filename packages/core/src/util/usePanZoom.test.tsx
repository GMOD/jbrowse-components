import { useRef } from 'react'

import { act, render, renderHook } from '@testing-library/react'

import { usePanZoom } from './usePanZoom.ts'

import type React from 'react'

// createWheelZoomController's own decision matrix is covered in wheelZoom.test;
// what is tested here is the composition — the drag loop, the modifier hint,
// and that both come undone on unmount.

// The controller batches every model write into a rAF, so drive frames
// deterministically rather than waiting on jsdom's timer-backed rAF.
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

function makeView(scrollZoom = true) {
  return {
    bpPerPx: 10,
    scrollZoom,
    zoomTo: jest.fn(),
    horizontalScroll: jest.fn(),
  }
}

// jsdom implements neither pointer capture nor PointerEvent, so the handlers
// are driven with the fields they read. `panning` is tracked in a ref, so the
// same stubbed element has to come back on every event of a gesture.
function pointerTarget() {
  let captured = false
  return {
    setPointerCapture: jest.fn(() => {
      captured = true
    }),
    releasePointerCapture: jest.fn(() => {
      captured = false
    }),
    hasPointerCapture: () => captured,
  }
}

function pointerEvent(
  x: number,
  target: ReturnType<typeof pointerTarget>,
  rest: { button?: number; shiftKey?: boolean; on?: Element } = {},
) {
  return {
    button: rest.button ?? 0,
    shiftKey: rest.shiftKey ?? false,
    pointerId: 1,
    clientX: x,
    target: rest.on ?? null,
    currentTarget: target,
  } as unknown as React.PointerEvent<HTMLElement>
}

function setupDrag(view = makeView()) {
  const ref = { current: document.createElement('div') }
  const { result, unmount } = renderHook(() => usePanZoom(ref, view))
  return { view, result, unmount, target: pointerTarget() }
}

test('a press under the drag threshold stays a click', () => {
  const { view, result, target } = setupDrag()
  const { onPointerDown, onPointerMove } = result.current.containerProps
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  act(() => {
    onPointerMove(pointerEvent(102, target))
  })

  expect(view.horizontalScroll).not.toHaveBeenCalled()
  // and the pointer was not captured, so the click still reaches the display
  // underneath — capturing on pointerdown is what would break that
  expect(target.setPointerCapture).not.toHaveBeenCalled()
})

test('past the threshold it pans by the delta between consecutive moves', () => {
  const { view, result, target } = setupDrag()
  const { onPointerDown, onPointerMove, onPointerUp } =
    result.current.containerProps
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  act(() => {
    onPointerMove(pointerEvent(90, target))
  })
  act(() => {
    onPointerMove(pointerEvent(85, target))
  })

  // dragging left moves the view right, and each move scrolls by its own delta
  // rather than by the distance from the anchor
  expect(view.horizontalScroll.mock.calls).toEqual([[10], [5]])
  expect(target.setPointerCapture).toHaveBeenCalledTimes(1)

  act(() => {
    onPointerUp(pointerEvent(85, target))
  })
  expect(target.releasePointerCapture).toHaveBeenCalledTimes(1)
  // the drag is over: a further move without a press does nothing
  act(() => {
    onPointerMove(pointerEvent(60, target))
  })
  expect(view.horizontalScroll).toHaveBeenCalledTimes(2)
})

test('pointercancel ends the drag, so a touch gesture cannot stay latched', () => {
  const { view, result, target } = setupDrag()
  const { onPointerDown, onPointerMove, onPointerCancel } =
    result.current.containerProps
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  act(() => {
    onPointerMove(pointerEvent(80, target))
  })
  act(() => {
    onPointerCancel(pointerEvent(80, target))
  })
  act(() => {
    onPointerMove(pointerEvent(40, target))
  })

  expect(view.horizontalScroll).toHaveBeenCalledTimes(1)
})

test.each([
  ['a non-primary button', { button: 2 }],
  ['a shift-press, left for a range select', { shiftKey: true }],
])('%s never starts a pan', (_name, rest) => {
  const { view, result, target } = setupDrag()
  const { onPointerDown, onPointerMove } = result.current.containerProps
  act(() => {
    onPointerDown(pointerEvent(100, target, rest))
  })
  act(() => {
    onPointerMove(pointerEvent(50, target))
  })

  expect(view.horizontalScroll).not.toHaveBeenCalled()
})

test.each(['button', '[data-gesture-owner]', '[draggable="true"]'])(
  'a press inside %s is left to the control that owns it',
  selector => {
    const { view, result, target } = setupDrag()
    const owner = document.createElement('div')
    owner.innerHTML =
      selector === 'button'
        ? '<button><span>icon</span></button>'
        : selector === '[draggable="true"]'
          ? '<div draggable="true"><span>icon</span></div>'
          : '<div data-gesture-owner="true"><span>icon</span></div>'
    // the press lands on the icon inside the control, which is why the check
    // has to be `closest` rather than a test on the target itself
    const icon = owner.querySelector('span')!
    const { onPointerDown, onPointerMove } = result.current.containerProps
    act(() => {
      onPointerDown(pointerEvent(100, target, { on: icon }))
    })
    act(() => {
      onPointerMove(pointerEvent(50, target))
    })

    expect(view.horizontalScroll).not.toHaveBeenCalled()
  },
)

// The wheel half, through the real listener the hook installs.
function wheel(el: Element, init: WheelEventInit) {
  const event = new WheelEvent('wheel', {
    cancelable: true,
    bubbles: true,
    ...init,
  })
  act(() => {
    el.dispatchEvent(event)
  })
  return event
}

function Harness({ view }: { view: ReturnType<typeof makeView> }) {
  const ref = useRef<HTMLDivElement>(null)
  const { showZoomHint } = usePanZoom(ref, view)
  return (
    <div ref={ref} data-testid="c">
      {showZoomHint ? 'hint' : ''}
    </div>
  )
}

test('the wheel is bound to the element, and unbound on unmount', () => {
  const view = makeView()
  const { getByTestId, unmount } = render(<Harness view={view} />)
  const el = getByTestId('c')

  wheel(el, { deltaY: 40 })
  flushRaf()
  expect(view.zoomTo).toHaveBeenCalledTimes(1)

  unmount()
  wheel(el, { deltaY: 40 })
  flushRaf()
  expect(view.zoomTo).toHaveBeenCalledTimes(1)
})

test('a wheel that needed ctrl raises the hint, and it clears itself', () => {
  jest.useFakeTimers()
  const view = makeView(false)
  const { getByTestId } = render(<Harness view={view} />)
  const el = getByTestId('c')

  wheel(el, { deltaY: 40 })
  flushRaf()
  // the page keeps the gesture — the view is what didn't move
  expect(view.zoomTo).not.toHaveBeenCalled()
  expect(el.textContent).toBe('hint')

  act(() => {
    jest.runAllTimers()
  })
  expect(el.textContent).toBe('')
  jest.useRealTimers()
})

test('a wheel that did zoom raises no hint', () => {
  const scrollZoomOn = render(<Harness view={makeView(true)} />)
  wheel(scrollZoomOn.getByTestId('c'), { deltaY: 40 })
  flushRaf()
  expect(scrollZoomOn.getByTestId('c').textContent).toBe('')
  scrollZoomOn.unmount()

  // ctrl+wheel zooms whatever the preference is, so it is not a missed gesture
  const ctrl = render(<Harness view={makeView(false)} />)
  wheel(ctrl.getByTestId('c'), { deltaY: 40, ctrlKey: true })
  flushRaf()
  expect(ctrl.getByTestId('c').textContent).toBe('')
})

test('a horizontal wheel with scroll-zoom off pans, and raises no hint', () => {
  const view = makeView(false)
  const { getByTestId } = render(<Harness view={view} />)
  const el = getByTestId('c')

  wheel(el, { deltaX: 40, deltaY: 0 })
  flushRaf()
  expect(view.horizontalScroll).toHaveBeenCalledWith(40)
  expect(el.textContent).toBe('')
})
