import { createRef } from 'react'

import { act, renderHook } from '@testing-library/react'

import { useDragSelection } from './useDragSelection.ts'

import type React from 'react'

const DATA_LEFT = 80

// `relativeXY` falls back to the raw client coords when the ref has no element,
// so an unattached ref lets these drive display-relative x/y directly.
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
    stopPropagation: extra?.stopPropagation ?? (() => {}),
  } as unknown as React.MouseEvent
}

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
// handle (coverage/conservation band, tree sidebar) whose `data-resizer` target
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

test('a press exactly on the sidebar edge is still the sidebar', () => {
  const { onClick, result } = setup()
  act(() => {
    result.current.handleMouseDown(mouseEvent(DATA_LEFT, 50))
  })
  act(() => {
    result.current.handleMouseUp(mouseEvent(DATA_LEFT, 50))
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
