import { createRef } from 'react'

import { act, renderHook } from '@testing-library/react'

import { showsHoverAt, useDragSelection } from './useDragSelection.ts'

import type React from 'react'

const DATA_LEFT = 80
const WIDTH = 1000
const HEIGHT = 400

// The events' container sits at the client origin, so these drive
// display-relative x/y directly.
function setup() {
  const onClick = jest.fn()
  const ref = createRef<HTMLDivElement>()
  const { result } = renderHook(() =>
    useDragSelection(ref, { dataLeft: DATA_LEFT, onClick }),
  )
  return { onClick, result }
}

function mouseEvent(
  x: number,
  y: number,
  extra?: { shiftKey?: boolean; stopPropagation?: () => void },
) {
  return {
    clientX: x,
    clientY: y,
    shiftKey: extra?.shiftKey ?? false,
    target: { closest: () => null },
    currentTarget: {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
      }),
    },
    stopPropagation: extra?.stopPropagation ?? (() => {}),
  } as unknown as React.MouseEvent
}

function pointerEvent(extra?: { pointerType?: string; shiftKey?: boolean }) {
  const stopPropagation = jest.fn()
  const event = {
    button: 0,
    pointerType: extra?.pointerType ?? 'mouse',
    shiftKey: extra?.shiftKey ?? false,
    target: { closest: () => null },
    stopPropagation,
  } as unknown as React.PointerEvent
  return { event, stopPropagation }
}

function capturingPointerMove() {
  const setPointerCapture = jest.fn()
  const event = {
    pointerId: 7,
    currentTarget: {
      setPointerCapture,
      hasPointerCapture: () => false,
    },
  } as unknown as React.PointerEvent
  return { event, setPointerCapture }
}

test('a mouse press is kept from the view, which pans on pointerdown', () => {
  const { result } = setup()
  const { event, stopPropagation } = pointerEvent()
  result.current.handlePointerDown(event)
  expect(stopPropagation).toHaveBeenCalled()
})

test('a touch and a shift-press reach the view', () => {
  const { result } = setup()
  const touch = pointerEvent({ pointerType: 'touch' })
  result.current.handlePointerDown(touch.event)
  expect(touch.stopPropagation).not.toHaveBeenCalled()
  const shift = pointerEvent({ shiftKey: true })
  result.current.handlePointerDown(shift.event)
  expect(shift.stopPropagation).not.toHaveBeenCalled()
})

test('press and release over the data area is a click', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(200, 50))
  })
  expect(onClick).toHaveBeenCalledWith(200, 50)
})

// A release the display never saw the press for: the press landed on a resize
// handle (coverage/conservation band, tree sidebar) whose `data-gesture-owner`
// makes `handleMouseDown` bail, and the pointer-capture drag then delivers the
// release here. Without the `isDragging` test this opened a feature widget for
// whatever insertion marker the cursor happened to land on.
test('release with no press of its own does not click', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseUp(mouseEvent(200, 50))
  })
  expect(onClick).not.toHaveBeenCalled()
})

test('press over the tree sidebar neither clicks nor starts a selection', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(DATA_LEFT - 10, 50))
  })
  expect(result.current.isDragging).toBe(false)
  act(() => {
    result.current.handleMouseMove(mouseEvent(400, 50))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(400, 50))
  })
  expect(onClick).not.toHaveBeenCalled()
  expect(result.current.contextCoord).toBeUndefined()
})

// DisplayChrome spreads these handlers onto a div inside the LGV's
// TracksContainer, whose own onMouseDown starts the view's click-drag pan. The
// press has to be swallowed even where it starts no selection, or pressing the
// tree sidebar pans the whole view.
test('a press over the sidebar is still swallowed', () => {
  const { result } = setup()
  const stopPropagation = jest.fn()
  act(() => {
    result.current.handleMouseDown(
      mouseEvent(DATA_LEFT - 10, 50, { stopPropagation }),
    )
  })
  expect(stopPropagation).toHaveBeenCalled()
})

// The resize handle covers [treeAreaWidth, dataLeft), so `dataLeft` is the
// first data pixel, as the crosshair, row hover and context menu all take it.
test('a press exactly on the sidebar edge is the first data pixel', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(DATA_LEFT, 50))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(DATA_LEFT, 50))
  })
  expect(onClick).toHaveBeenCalledWith(DATA_LEFT, 50)
})

test('a press short of the edge is the resize handle', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(DATA_LEFT - 0.5, 50))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(DATA_LEFT - 0.5, 50))
  })
  expect(onClick).not.toHaveBeenCalled()
})

test('a far drag yields a context coord instead of a click', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  act(() => {
    result.current.handleMouseMove(mouseEvent(300, 60))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(300, 60))
  })
  expect(onClick).not.toHaveBeenCalled()
  expect(result.current.contextCoord).toMatchObject({
    startX: 200,
    endX: 300,
  })
  expect(result.current.showSelectionBox).toBe(true)
})

test('shift-press is reserved for the view and starts nothing', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50, { shiftKey: true }))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(200, 50))
  })
  expect(onClick).not.toHaveBeenCalled()
})

// React bubbles a portal's events to its React parent, so a press in a dialog
// the display opened arrives at the display's handlers from outside its DOM.
test('a press in a portal is left alone and starts nothing', () => {
  const { result } = setup()
  const stopPropagation = jest.fn()
  const press = {
    button: 0,
    pointerType: 'mouse',
    shiftKey: false,
    clientX: 200,
    clientY: 50,
    target: document.createElement('div'),
    currentTarget: document.createElement('div'),
    stopPropagation,
  } as unknown as React.PointerEvent
  result.current.handlePointerDown(press)
  act(() => {
    result.current.handleMouseDown(press)
  })
  act(() => {
    result.current.handleMouseMove(mouseEvent(300, 60))
  })
  expect(stopPropagation).not.toHaveBeenCalled()
  expect(result.current.isDragging).toBe(false)
})

test('a live drag captures the pointer so it survives leaving the track', () => {
  const { result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  const move = capturingPointerMove()
  act(() => {
    result.current.handlePointerMove(move.event)
  })
  expect(move.setPointerCapture).toHaveBeenCalledWith(7)
})

test('a plain hover does not capture the pointer', () => {
  const { result } = setup()
  const move = capturingPointerMove()
  act(() => {
    result.current.handlePointerMove(move.event)
  })
  expect(move.setPointerCapture).not.toHaveBeenCalled()
})

test('a drag released past the bottom edge selects to the edge', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  act(() => {
    result.current.handleMouseMove(mouseEvent(300, HEIGHT + 90))
  })
  expect(result.current.selectionRect).toMatchObject({ endY: HEIGHT })
  act(() => {
    result.current.handleMouseUp(mouseEvent(300, HEIGHT + 90))
  })
  expect(onClick).not.toHaveBeenCalled()
  expect(result.current.contextCoord).toMatchObject({
    startY: 50,
    endY: HEIGHT,
  })
})

test('a drag released past the top and right edges clamps both', () => {
  const { result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  act(() => {
    result.current.handleMouseMove(mouseEvent(WIDTH + 40, -30))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(WIDTH + 40, -30))
  })
  expect(result.current.contextCoord).toMatchObject({
    endX: WIDTH,
    endY: 0,
  })
})

test('a cancelled pointer ends the drag without a click', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(200, 50))
  })
  act(() => {
    result.current.handlePointerCancel()
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(200, 50))
  })
  expect(onClick).not.toHaveBeenCalled()
})

describe('hover while the pointer is captured', () => {
  const track = { dataLeft: DATA_LEFT, width: WIDTH, height: HEIGHT }

  test('past the track edge a drag shows no crosshair or tooltip', () => {
    for (const mouse of [
      { x: WIDTH + 20, y: 100 },
      { x: 300, y: HEIGHT + 20 },
      { x: 300, y: -20 },
    ]) {
      expect(showsHoverAt(mouse, track, true)).toBe(false)
    }
  })

  test('inside the track a drag shows them', () => {
    expect(showsHoverAt({ x: 300, y: 100 }, track, true)).toBe(true)
  })

  test('the sidebar never shows them', () => {
    expect(showsHoverAt({ x: DATA_LEFT - 1, y: 100 }, track, false)).toBe(false)
  })
})
