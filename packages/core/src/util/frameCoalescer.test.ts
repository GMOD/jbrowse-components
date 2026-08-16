import { createFrameCoalescer } from './frameCoalescer.ts'

// A controllable frame clock: rAF callbacks queue here and run only when the
// test says so, which is the whole point — what is under test is what happens
// between the schedule and the frame.
function fakeFrames() {
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
  return {
    run(now = 0) {
      const due = [...queued.values()]
      queued.clear()
      for (const cb of due) {
        cb(now)
      }
    },
    get queued() {
      return queued.size
    },
    restore() {
      raf.mockRestore()
      cancel.mockRestore()
    },
  }
}

let frames: ReturnType<typeof fakeFrames>

beforeEach(() => {
  frames = fakeFrames()
})

afterEach(() => {
  frames.restore()
})

test('a burst of schedules flushes once', () => {
  const flush = jest.fn()
  const c = createFrameCoalescer()
  c.schedule(flush)
  c.schedule(flush)
  c.schedule(flush)
  expect(flush).not.toHaveBeenCalled()

  frames.run(123)
  expect(flush).toHaveBeenCalledTimes(1)
  expect(flush).toHaveBeenCalledWith(123)
})

// The half that is invisible when missing: a pending frame holds a closure over
// a view that can be detached before it runs.
test('cancel stops the pending flush', () => {
  const flush = jest.fn()
  const c = createFrameCoalescer()
  c.schedule(flush)
  c.cancel()

  frames.run()
  expect(flush).not.toHaveBeenCalled()
  expect(c.pending).toBe(false)
})

test('cancel with nothing pending is a no-op, and can be repeated', () => {
  const c = createFrameCoalescer()
  expect(() => {
    c.cancel()
    c.cancel()
  }).not.toThrow()
})

// Callers accumulate into their own state and read it in the flush, so the
// first scheduler of a frame owning it is what they want — not a later one
// replacing the callback.
test('the first scheduler of a frame owns it', () => {
  const first = jest.fn()
  const second = jest.fn()
  const c = createFrameCoalescer()
  c.schedule(first)
  c.schedule(second)

  frames.run()
  expect(first).toHaveBeenCalledTimes(1)
  expect(second).not.toHaveBeenCalled()
})

// `pending` is how a caller asks "is this the first event of a frame", which is
// where it re-syncs its accumulator to live state.
test('pending tracks the frame, and clears before the flush runs', () => {
  const c = createFrameCoalescer()
  expect(c.pending).toBe(false)

  let pendingInsideFlush: boolean | undefined
  c.schedule(() => {
    pendingInsideFlush = c.pending
  })
  expect(c.pending).toBe(true)

  frames.run()
  // cleared first, so a flush that reschedules gets the next frame rather than
  // being swallowed
  expect(pendingInsideFlush).toBe(false)
  expect(c.pending).toBe(false)
})

test('a flush may schedule the next frame', () => {
  const c = createFrameCoalescer()
  let runs = 0
  const flush = () => {
    runs++
    if (runs < 3) {
      c.schedule(flush)
    }
  }
  c.schedule(flush)
  frames.run()
  frames.run()
  frames.run()
  expect(runs).toBe(3)
  expect(frames.queued).toBe(0)
})
