import { act, fireEvent, render } from '@testing-library/react'

import ResizeHandle from './ResizeHandle.tsx'

// Faithful rAF mock (same shape as useRafCommit.test): cancel really drops the
// callback, so the unmount-cancel path is exercised rather than assumed.
let rafMap = new Map<number, FrameRequestCallback>()
let nextRafId = 1
const realRaf = window.requestAnimationFrame
const realCancel = window.cancelAnimationFrame

beforeEach(() => {
  rafMap = new Map()
  nextRafId = 1
  window.requestAnimationFrame = cb => {
    const id = nextRafId++
    rafMap.set(id, cb)
    return id
  }
  window.cancelAnimationFrame = id => {
    rafMap.delete(id)
  }
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
  window.cancelAnimationFrame = realCancel
})

function flushRaf() {
  const cbs = [...rafMap.values()]
  rafMap = new Map()
  act(() => {
    for (const cb of cbs) {
      cb(0)
    }
  })
}

function drag(el: HTMLElement, ys: number[]) {
  fireEvent.pointerDown(el, { clientY: 0, pointerId: 1, button: 0 })
  for (const clientY of ys) {
    fireEvent.pointerMove(el, { clientY, pointerId: 1 })
  }
}

describe('ResizeHandle', () => {
  it('reports the distance dragged, once per frame', () => {
    const onDrag = jest.fn()
    const { container } = render(<ResizeHandle onDrag={onDrag} />)
    const handle = container.firstChild as HTMLElement

    drag(handle, [10, 20, 30])
    // three moves in one frame coalesce to a single commit carrying the total
    expect(onDrag).not.toHaveBeenCalled()
    flushRaf()
    expect(onDrag).toHaveBeenCalledTimes(1)
    expect(onDrag).toHaveBeenCalledWith(30)

    // the next frame's delta is measured from the last committed position, so
    // the coalescing never loses or double-counts distance
    fireEvent.pointerMove(handle, { clientY: 45, pointerId: 1 })
    flushRaf()
    expect(onDrag).toHaveBeenLastCalledWith(15)
  })

  it('flushes the pending frame on drag end, so the resting size is exact', () => {
    const onDrag = jest.fn()
    const onDragEnd = jest.fn()
    const { container } = render(
      <ResizeHandle onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const handle = container.firstChild as HTMLElement

    drag(handle, [25])
    fireEvent.pointerUp(handle, { clientY: 25, pointerId: 1 })
    expect(onDrag).toHaveBeenCalledWith(25)
    expect(onDragEnd).toHaveBeenCalled()
  })

  // the hand-rolled rAF this replaced had no cleanup, so a drag interrupted by
  // an unmount fired onDrag into a torn-down tree
  it('cancels a pending frame on unmount', () => {
    const onDrag = jest.fn()
    const { container, unmount } = render(<ResizeHandle onDrag={onDrag} />)
    drag(container.firstChild as HTMLElement, [10])

    unmount()
    flushRaf()
    expect(onDrag).not.toHaveBeenCalled()
  })

  it('claims the press so ancestor gestures stand down', () => {
    const { container } = render(<ResizeHandle onDrag={() => {}} />)
    expect((container.firstChild as HTMLElement).dataset.gestureOwner).toBe(
      'true',
    )
  })
})
