import ActionBuffer from '../ActionLogger/ActionBuffer.ts'
import { ActionType, type ClassifiedAction } from '../ActionLogger/ActionTypes.ts'

function makeAction(
  type: ActionType,
  timestamp: number,
  metadata: Record<string, unknown> = {},
): ClassifiedAction {
  return {
    type,
    timestamp,
    sourceAction: 'test',
    metadata,
  }
}

describe('ActionBuffer', () => {
  jest.useFakeTimers()

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('emits debounced action after debounce window', () => {
    const buffer = new ActionBuffer(100, 500)
    const received: ClassifiedAction[] = []
    buffer.onDebouncedAction(a => received.push(a))

    buffer.push(makeAction(ActionType.PAN, 1000, { distance: 10 }))
    expect(received).toHaveLength(0)

    jest.advanceTimersByTime(500)
    expect(received).toHaveLength(1)
    expect(received[0]!.type).toBe(ActionType.PAN)
  })

  it('merges rapid same-type actions', () => {
    const buffer = new ActionBuffer(100, 500)
    const received: ClassifiedAction[] = []
    buffer.onDebouncedAction(a => received.push(a))

    // Three PAN events within the debounce window
    buffer.push(makeAction(ActionType.PAN, 1000, { distance: 10 }))
    buffer.push(makeAction(ActionType.PAN, 1100, { distance: 20 }))
    buffer.push(makeAction(ActionType.PAN, 1200, { distance: 30 }))

    jest.advanceTimersByTime(500)
    expect(received).toHaveLength(1)
    // Distance should accumulate
    expect(received[0]!.metadata.distance).toBe(60)
  })

  it('does not merge different action types', () => {
    const buffer = new ActionBuffer(100, 500)
    const received: ClassifiedAction[] = []
    buffer.onDebouncedAction(a => received.push(a))

    buffer.push(makeAction(ActionType.PAN, 1000))
    buffer.push(makeAction(ActionType.ZOOM, 1100))

    jest.advanceTimersByTime(500)
    expect(received).toHaveLength(2)
    expect(received[0]!.type).toBe(ActionType.PAN)
    expect(received[1]!.type).toBe(ActionType.ZOOM)
  })

  it('respects maxSize eviction', () => {
    const buffer = new ActionBuffer(2, 10)
    for (let i = 0; i < 5; i++) {
      buffer.push(makeAction(ActionType.ZOOM, 1000 + i * 100))
      jest.advanceTimersByTime(20)
    }
    const recent = buffer.getRecent(10)
    expect(recent.length).toBeLessThanOrEqual(2)
  })

  it('drain() flushes pending and returns all buffered', () => {
    const buffer = new ActionBuffer(100, 500)
    buffer.push(makeAction(ActionType.PAN, 1000))
    buffer.push(makeAction(ActionType.ZOOM, 2000))
    const drained = buffer.drain()
    expect(drained.length).toBeGreaterThanOrEqual(1)
  })

  it('dispose() clears debounce timer', () => {
    const buffer = new ActionBuffer(100, 500)
    const received: ClassifiedAction[] = []
    buffer.onDebouncedAction(a => received.push(a))

    buffer.push(makeAction(ActionType.PAN, 1000))
    buffer.dispose()
    jest.advanceTimersByTime(1000)
    // After dispose, the timer shouldn't fire
    expect(received).toHaveLength(0)
  })
})
