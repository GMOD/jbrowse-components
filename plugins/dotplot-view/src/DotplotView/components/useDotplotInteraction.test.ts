import { act, renderHook } from '@testing-library/react'

import { useDotplotInteraction } from './useDotplotInteraction.ts'

import type { DotplotViewModel } from '../model.ts'
import type React from 'react'

// A pan scrolls both axes by the delta since the previous pointer sample, so a
// stream of moves must scroll by consecutive deltas rather than re-applying the
// distance from the drag anchor each time. The vertical axis lays out bottom-up,
// so its delta is negated relative to the horizontal one.
//
// The hook reaches the axes through the model's one `scrollXY` action rather
// than scrolling each itself, so that is what these assert on — two writes
// unbatched drew a frame against a moved h axis and a stale v one.
function setup(cursorMode: 'move' | 'crosshair') {
  const scrollXY = jest.fn()
  const zoomAt = jest.fn()
  const setHoveredFeature = jest.fn()
  const hit = { displayKey: 1, featureIdx: 7, distancePx: 0 }
  const pickFeatureAt = jest.fn(() => hit)
  const model = {
    scrollXY,
    zoomAt,
    setHoveredFeature,
    pickFeatureAt,
    cursorMode,
    lockAspectRatio: false,
  } as unknown as DotplotViewModel
  const { result, unmount } = renderHook(() => useDotplotInteraction(model))
  return {
    scrollXY,
    zoomAt,
    setHoveredFeature,
    pickFeatureAt,
    hit,
    result,
    unmount,
  }
}

// Attach the container ref and run the wheel listener's rAF body inline, which
// is the only way to observe it — React attaches wheel passively, so the hook
// registers it by hand on the element rather than through containerProps.
function wheel(
  result: { current: ReturnType<typeof useDotplotInteraction> },
  init: WheelEventInit,
) {
  const el = document.createElement('div')
  act(() => {
    result.current.containerProps.ref(el)
  })
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(cb => {
      cb(0)
      return 0
    })
  act(() => {
    el.dispatchEvent(new WheelEvent('wheel', init))
  })
  raf.mockRestore()
}

// getBoundingClientRect is stubbed at the origin so component-relative x/y are
// the client coords; jsdom would otherwise report all-zero anyway.
function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    ctrlKey: false,
    metaKey: false,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      setPointerCapture: () => {},
    },
  } as unknown as React.PointerEvent<HTMLDivElement>
}

test('a pan scrolls by the delta between consecutive moves', () => {
  const { scrollXY, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerDown(pointerEvent(100, 100))
  })
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(110, 120))
  })
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(115, 125))
  })

  // h scrolls by -(dx) as the content follows the pointer; v is inverted
  expect(scrollXY.mock.calls).toEqual([
    [-10, 20],
    [-5, 5],
  ])
})

// In crosshair mode a drag is a selection, so the axes must not move under it.
test('a selection drag does not scroll either axis', () => {
  const { scrollXY, result } = setup('crosshair')
  act(() => {
    result.current.containerProps.onPointerDown(pointerEvent(100, 100))
  })
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(160, 160))
  })

  expect(scrollXY).not.toHaveBeenCalled()
  expect(result.current.selecting).toBe(true)
})

// A move with no button down is a hover: it feeds the tooltip and must not
// scroll.
test('hovering does not scroll', () => {
  const { scrollXY, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(140, 140))
  })

  expect(scrollXY).not.toHaveBeenCalled()
  expect(result.current.pointer?.x).toBe(140)
})

test('hovering picks the alignment under the pointer', () => {
  const { pickFeatureAt, setHoveredFeature, hit, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(140, 150))
  })

  expect(pickFeatureAt).toHaveBeenCalledWith(140, 150)
  expect(setHoveredFeature).toHaveBeenCalledWith(hit)
})

// Both drags: a pan would pull the plot out from under the highlight, and a
// selection drag wants this anchor for its own two coordinate tooltips. The
// clear happens once, at pointerdown, rather than per move.
test.each(['move', 'crosshair'] as const)(
  'a %s drag drops the hover and picks nothing more',
  cursorMode => {
    const { pickFeatureAt, setHoveredFeature, result } = setup(cursorMode)
    act(() => {
      result.current.containerProps.onPointerDown(pointerEvent(100, 100))
    })
    expect(setHoveredFeature).toHaveBeenCalledWith(undefined)
    pickFeatureAt.mockClear()

    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(160, 160))
    })
    expect(pickFeatureAt).not.toHaveBeenCalled()
  },
)

// The hook does NOT clear the hover on a wheel, deliberately: a wheel moves the
// plot under a stationary cursor, and the view answers that for every way the
// plot can move (`setupClearHoverOnPlotMove`). Clearing here too would be a
// second copy of one rule — pinned so the copy doesn't come back.
test.each([
  ['pan', { deltaX: 40, deltaY: 0 }],
  ['zoom', { deltaX: 0, deltaY: -120 }],
])('a wheel %s leaves the hover to the view', (_name, init) => {
  const { setHoveredFeature, scrollXY, zoomAt, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(140, 140))
  })
  wheel(result, init)

  expect(scrollXY.mock.calls.length + zoomAt.mock.calls.length).toBe(1)
  expect(setHoveredFeature).not.toHaveBeenCalledWith(undefined)
})

// Both halves of it: the alignment the pointer was over, and the sample itself
// — which is what tells the coordinate tooltip there is no pointer, so there is
// no separate `hovering` flag that something else can lower and leave lowered.
test('leaving the plot drops the hover and the pointer with it', () => {
  const { setHoveredFeature, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(140, 140))
  })
  expect(result.current.pointer).toBeDefined()

  act(() => {
    result.current.containerProps.onPointerLeave()
  })
  expect(setHoveredFeature).toHaveBeenLastCalledWith(undefined)
  expect(result.current.pointer).toBeUndefined()
})

// A wheel accumulates into a frame, and closing the view before that frame runs
// used to flush into a destroyed MST node — the model call throws there, so the
// fling that outlived its view took the page down with it. The listener is gone
// by then; the frame is what has to be cancelled, and `createFrameCoalescer`
// hands the effect that cancel.
test('a view closed before the frame runs does not write to it', () => {
  const { zoomAt, scrollXY, result, unmount } = setup('move')
  const el = document.createElement('div')
  act(() => {
    result.current.containerProps.ref(el)
  })
  // A frame queue the test owns, so the cancel is observable: the real
  // cancelAnimationFrame would take an id this fake never issued.
  const queued = new Map<number, FrameRequestCallback>()
  let nextId = 1
  const raf = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation(cb => {
      const id = nextId++
      queued.set(id, cb)
      return id
    })
  const cancel = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(id => {
      queued.delete(id)
    })
  act(() => {
    el.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -120 }))
  })
  expect(queued.size).toBe(1)

  unmount()
  expect(queued.size).toBe(0)
  raf.mockRestore()
  cancel.mockRestore()

  expect(zoomAt).not.toHaveBeenCalled()
  expect(scrollXY).not.toHaveBeenCalled()
})

// The same button that started the drag ends it. A right-click during a
// selection used to commit the box and open the menu under the browser's own
// context menu; during a pan it dropped the anchor mid-stroke.
test('a non-primary release leaves the gesture alone', () => {
  const { result } = setup('crosshair')
  act(() => {
    result.current.containerProps.onPointerDown(pointerEvent(100, 100))
  })
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(200, 200))
  })
  expect(result.current.selecting).toBe(true)

  act(() => {
    result.current.containerProps.onPointerUp({
      ...pointerEvent(200, 200),
      button: 2,
    })
  })
  // still dragging: not committed, and the anchor is intact
  expect(result.current.committed).toBe(false)
  expect(result.current.anchor).toBeDefined()

  act(() => {
    result.current.containerProps.onPointerUp(pointerEvent(200, 200))
  })
  expect(result.current.committed).toBe(true)
})
