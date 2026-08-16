import { act, renderHook } from '@testing-library/react'

import { useCoalescedPointer } from './useCoalescedPointer.ts'

// jsdom's rAF is a timer, so the frame is driven explicitly rather than waited
// for — every assertion below is about what happens between a queue and its
// frame, which is the whole of what this hook decides.
let frames: (() => void)[] = []

beforeEach(() => {
  frames = []
  jest
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      frames.push(() => {
        cb(0)
      })
      return frames.length
    })
  jest
    .spyOn(globalThis, 'cancelAnimationFrame')
    .mockImplementation((handle: number) => {
      frames[handle - 1] = () => {}
    })
})

afterEach(() => {
  jest.restoreAllMocks()
})

function runFrames() {
  const pending = frames
  frames = []
  for (const frame of pending) {
    act(() => {
      frame()
    })
  }
}

function setup() {
  const onFrame = jest.fn()
  const { result, unmount } = renderHook(() =>
    useCoalescedPointer<number>(onFrame),
  )
  return { onFrame, result, unmount }
}

test('many events in one frame run the handler once, on the latest', () => {
  const { onFrame, result } = setup()
  act(() => {
    result.current.queue(1)
    result.current.queue(2)
    result.current.queue(3)
  })
  expect(onFrame).not.toHaveBeenCalled()
  runFrames()
  expect(onFrame).toHaveBeenCalledTimes(1)
  expect(onFrame).toHaveBeenCalledWith(3)
})

test('a later event schedules a fresh frame', () => {
  const { onFrame, result } = setup()
  act(() => {
    result.current.queue(1)
  })
  runFrames()
  act(() => {
    result.current.queue(2)
  })
  runFrames()
  expect(onFrame.mock.calls).toEqual([[1], [2]])
})

// The leave case: a frame queued just before the pointer leaves would otherwise
// land after it has gone and re-light the hover the leave handler cleared.
test('cancel drops a queued frame', () => {
  const { onFrame, result } = setup()
  act(() => {
    result.current.queue(1)
    result.current.cancel()
  })
  runFrames()
  expect(onFrame).not.toHaveBeenCalled()
})

test('queueing again after a cancel still runs', () => {
  const { onFrame, result } = setup()
  act(() => {
    result.current.queue(1)
    result.current.cancel()
    result.current.queue(2)
  })
  runFrames()
  expect(onFrame).toHaveBeenCalledTimes(1)
  expect(onFrame).toHaveBeenCalledWith(2)
})

// A display is detached from the MST tree before React unmounts it, so a frame
// landing in between writes onto a dead node.
test('unmount drops a queued frame', () => {
  const { onFrame, result, unmount } = setup()
  act(() => {
    result.current.queue(1)
  })
  unmount()
  runFrames()
  expect(onFrame).not.toHaveBeenCalled()
})

// The handler is reached through a ref, so a frame scheduled by one render runs
// the callback the latest render supplied — the closure that scheduled it may
// already hold stale props.
test('the frame runs the latest handler, not the one that scheduled it', () => {
  const first = jest.fn()
  const second = jest.fn()
  const { result, rerender } = renderHook(
    ({ onFrame }: { onFrame: (n: number) => void }) =>
      useCoalescedPointer(onFrame),
    { initialProps: { onFrame: first } },
  )
  act(() => {
    result.current.queue(1)
  })
  rerender({ onFrame: second })
  runFrames()
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledWith(1)
})
