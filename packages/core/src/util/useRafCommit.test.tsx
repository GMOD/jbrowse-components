import { act, render } from '@testing-library/react'

import { useRafCommit } from './useRafCommit.ts'

// Faithful rAF mock: cancel actually drops the callback (as the browser does),
// so the flush/unmount cancel paths are exercised, not just the happy path.
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

let api: ReturnType<typeof useRafCommit>
function Harness({ onCommit }: { onCommit: (n: number) => void }) {
  api = useRafCommit(onCommit)
  return null
}

test('coalesces a burst of schedules into one commit with the last value', () => {
  const onCommit = jest.fn()
  render(<Harness onCommit={onCommit} />)

  api.schedule(10)
  api.schedule(20)
  api.schedule(30)
  // nothing committed synchronously — deferred to the frame
  expect(onCommit).not.toHaveBeenCalled()

  flushRaf()
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onCommit).toHaveBeenLastCalledWith(30)
})

test('flush commits the pending value now and cancels the frame', () => {
  const onCommit = jest.fn()
  render(<Harness onCommit={onCommit} />)

  api.schedule(42)
  act(() => {
    api.flush()
  })
  expect(onCommit).toHaveBeenCalledTimes(1)
  expect(onCommit).toHaveBeenLastCalledWith(42)

  // the frame was canceled, so nothing fires later
  flushRaf()
  expect(onCommit).toHaveBeenCalledTimes(1)
})

test('flush with nothing pending is a no-op', () => {
  const onCommit = jest.fn()
  render(<Harness onCommit={onCommit} />)

  act(() => {
    api.flush()
  })
  expect(onCommit).not.toHaveBeenCalled()
})

test('each frame commits independently', () => {
  const onCommit = jest.fn()
  render(<Harness onCommit={onCommit} />)

  api.schedule(1)
  flushRaf()
  api.schedule(2)
  flushRaf()

  expect(onCommit).toHaveBeenCalledTimes(2)
  expect(onCommit).toHaveBeenNthCalledWith(1, 1)
  expect(onCommit).toHaveBeenNthCalledWith(2, 2)
})

test('unmount cancels a pending commit', () => {
  const onCommit = jest.fn()
  const { unmount } = render(<Harness onCommit={onCommit} />)

  api.schedule(99)
  unmount()
  flushRaf()

  expect(onCommit).not.toHaveBeenCalled()
})
