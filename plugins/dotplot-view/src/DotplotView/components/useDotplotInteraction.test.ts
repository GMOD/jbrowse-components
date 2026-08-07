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
  const model = {
    scrollXY,
    cursorMode,
    lockAspectRatio: false,
  } as unknown as DotplotViewModel
  const { result } = renderHook(() => useDotplotInteraction(model))
  return { scrollXY, result }
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

// A move with no button down is a hover: it feeds the coordinate tooltip and
// must not scroll.
test('hovering does not scroll', () => {
  const { scrollXY, result } = setup('move')
  act(() => {
    result.current.containerProps.onPointerMove(pointerEvent(140, 140))
  })

  expect(scrollXY).not.toHaveBeenCalled()
  expect(result.current.pointer?.x).toBe(140)
})
