import { act, renderHook } from '@testing-library/react'

import { usePointerDrag } from './usePointerDrag.ts'

import type React from 'react'

// The two guards below are the reason this file exists. Both holes were open
// for as long as the hook had a single consumer (`useResizeDrag`, so every
// track divider in JBrowse) and neither is reachable on a desktop with one
// mouse button, which is the shape of bug a unit test is for.

// jsdom implements neither pointer capture nor PointerEvent, so the handlers
// are driven with the fields they read.
function pointerTarget() {
  let captured: number | undefined
  return {
    setPointerCapture: jest.fn((id: number) => {
      captured = id
    }),
    releasePointerCapture: jest.fn(() => {
      captured = undefined
    }),
    hasPointerCapture: (id: number) => captured === id,
  }
}

function pointerEvent(
  x: number,
  target: ReturnType<typeof pointerTarget>,
  { button = 0, pointerId = 1 } = {},
) {
  return {
    button,
    pointerId,
    clientX: x,
    currentTarget: target,
  } as unknown as React.PointerEvent
}

function setup() {
  const onDragStart = jest.fn()
  const onDrag = jest.fn()
  const onDragEnd = jest.fn()
  const { result } = renderHook(() =>
    usePointerDrag({ onDragStart, onDrag, onDragEnd }),
  )
  return { onDragStart, onDrag, onDragEnd, result, target: pointerTarget() }
}

test('a primary press captures the pointer and reports every move', () => {
  const { onDragStart, onDrag, onDragEnd, result, target } = setup()
  const { onPointerDown, onPointerMove, onPointerUp } = result.current
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  act(() => {
    onPointerMove(pointerEvent(120, target))
  })
  act(() => {
    onPointerMove(pointerEvent(140, target))
  })
  act(() => {
    onPointerUp(pointerEvent(140, target))
  })

  expect(onDragStart).toHaveBeenCalledTimes(1)
  expect(onDrag.mock.calls.map(([e]) => e.clientX)).toEqual([120, 140])
  expect(onDragEnd).toHaveBeenCalledTimes(1)
  // capture on the press, so the drag survives the cursor leaving the element
  // and ends even if the button comes up outside the window. Nothing releases
  // it: the browser does that implicitly at pointerup.
  expect(target.setPointerCapture).toHaveBeenCalledTimes(1)

  // the drag is over, so a stray move without a press does nothing
  act(() => {
    onPointerMove(pointerEvent(200, target))
  })
  expect(onDrag).toHaveBeenCalledTimes(2)
})

test('a secondary press starts nothing at all', () => {
  const { onDragStart, onDrag, result, target } = setup()
  const { onPointerDown, onPointerMove } = result.current
  act(() => {
    onPointerDown(pointerEvent(100, target, { button: 2 }))
  })
  act(() => {
    onPointerMove(pointerEvent(140, target, { button: 2 }))
  })

  // `pointerdown` fires for a right-click too, and taking it means a resize
  // handle drags under its own context menu
  expect(onDragStart).not.toHaveBeenCalled()
  expect(onDrag).not.toHaveBeenCalled()
  expect(target.setPointerCapture).not.toHaveBeenCalled()
})

test('a second pointer neither starts a drag nor re-anchors the one in flight', () => {
  const { onDragStart, onDrag, onDragEnd, result, target } = setup()
  const { onPointerDown, onPointerMove, onPointerUp } = result.current
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  // a second finger lands mid-drag. Taking its press would re-anchor the
  // gesture, so the next move of the FIRST finger jumps by the distance
  // between the two; taking its moves is the same jump without the press,
  // since a pointer nobody captured still reports moves to the element it is
  // over.
  act(() => {
    onPointerDown(pointerEvent(500, target, { pointerId: 2 }))
  })
  act(() => {
    onPointerMove(pointerEvent(520, target, { pointerId: 2 }))
  })
  act(() => {
    onPointerMove(pointerEvent(120, target))
  })

  expect(onDragStart).toHaveBeenCalledTimes(1)
  expect(onDrag.mock.calls.map(([e]) => e.clientX)).toEqual([120])
  expect(target.setPointerCapture).toHaveBeenCalledTimes(1)

  // and its release must not end the first finger's drag either
  act(() => {
    onPointerUp(pointerEvent(520, target, { pointerId: 2 }))
  })
  expect(onDragEnd).not.toHaveBeenCalled()
  act(() => {
    onPointerMove(pointerEvent(160, target))
  })
  expect(onDrag).toHaveBeenCalledTimes(2)
})

test('pointercancel ends the drag', () => {
  const { onDrag, onDragEnd, result, target } = setup()
  const { onPointerDown, onPointerMove, onPointerCancel } = result.current
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  // a touch drag the browser takes over never fires `up`, so a handler
  // watching only that stays latched for the rest of the page's life
  act(() => {
    onPointerCancel(pointerEvent(100, target))
  })
  act(() => {
    onPointerMove(pointerEvent(140, target))
  })

  expect(onDragEnd).toHaveBeenCalledTimes(1)
  expect(onDrag).not.toHaveBeenCalled()
})

test('a fresh press after a cancelled drag works', () => {
  const { onDragStart, onDrag, result, target } = setup()
  const { onPointerDown, onPointerMove, onPointerCancel } = result.current
  act(() => {
    onPointerDown(pointerEvent(100, target))
  })
  act(() => {
    onPointerCancel(pointerEvent(100, target))
  })
  // the pointer that owned the drag has to be forgotten, not merely marked
  // finished — otherwise the guard that keeps a second pointer out keeps
  // everything out
  act(() => {
    onPointerDown(pointerEvent(200, target, { pointerId: 7 }))
  })
  act(() => {
    onPointerMove(pointerEvent(240, target, { pointerId: 7 }))
  })

  expect(onDragStart).toHaveBeenCalledTimes(2)
  expect(onDrag.mock.calls.map(([e]) => e.clientX)).toEqual([240])
})
