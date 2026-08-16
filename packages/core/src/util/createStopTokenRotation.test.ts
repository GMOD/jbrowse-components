import { types } from '@jbrowse/mobx-state-tree'

import { createStopTokenRotation } from './createStopTokenRotation.ts'
import { isStopped } from './stopToken.ts'

import type { RpcStatus } from './progress.ts'

// The bare-autorun fetches (dotplot, synteny, multi-sample-variant sources, the
// circular chord display) get their token rotation from here rather than from
// `FetchMixin.runFetch`. Covered indirectly by those displays' suites — except
// `dispose`, which none of them exercise, and which is the half that runs when
// the display goes away mid-fetch.
const Model = types
  .model('RotationHost', {})
  .volatile(() => ({ statusMessage: undefined as RpcStatus | undefined }))
  .actions(self => ({
    setStatusMessage(status?: RpcStatus) {
      self.statusMessage = status
    },
  }))

function makeHost() {
  return Model.create({})
}

test('begin() stops the fetch it supersedes and un-currents its guard', () => {
  const rotation = createStopTokenRotation(makeHost())
  const first = rotation.begin()
  expect(first.isCurrent()).toBe(true)
  const second = rotation.begin()
  expect(isStopped(first.stopToken)).toBe(true)
  expect(first.isCurrent()).toBe(false)
  expect(second.isCurrent()).toBe(true)
  rotation.dispose()
})

// A fetch that *completed* owns a token nobody else will ever stop — every one
// but the last is released by its successor — so without this the final fetch of
// a display's life retains its blob URL and every AbortController taken against
// it for the life of the document.
test('dispose() stops the token the last fetch is still holding', () => {
  const rotation = createStopTokenRotation(makeHost())
  const { stopToken } = rotation.begin()
  expect(isStopped(stopToken)).toBe(false)
  rotation.dispose()
  expect(isStopped(stopToken)).toBe(true)
})

test('dispose() is safe when no fetch ever began', () => {
  expect(() => {
    createStopTokenRotation(makeHost()).dispose()
  }).not.toThrow()
})

describe('the status window', () => {
  let clock = 1_000_000
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('a superseded fetch cannot repaint the status', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    const first = rotation.begin()
    rotation.begin()
    first.statusCallback('Downloading')
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  test('each fetch reopens the window, so its first status lands at once', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    rotation.begin().statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    // same tick: without the reset in begin() this would be thinned out
    rotation.begin().statusCallback('Parsing')
    expect(host.statusMessage).toBe('Parsing')
    rotation.dispose()
  })

  // The guard makes a late write a no-op rather than a write to a dead node, but
  // the timer itself still stands for up to a window past teardown.
  test('dispose() drops a queued trailing write', () => {
    jest.useFakeTimers()
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    const { statusCallback } = rotation.begin()
    statusCallback('Downloading')
    // same tick, so this one is queued on the trailing timer
    statusCallback('Parsing')
    rotation.dispose()
    expect(jest.getTimerCount()).toBe(0)
    clock += 100
    jest.advanceTimersByTime(100)
    expect(host.statusMessage).toBe('Downloading')
  })

  // A run that COMPLETES still holds the current token, so the token comparison
  // alone leaves its guard open — this is the term that closes it, and without
  // it the queued write below lands on top of the clear.
  test('end() clears, and drops the write queued behind the clear', () => {
    jest.useFakeTimers()
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    const fetch = rotation.begin()
    fetch.statusCallback('Downloading')
    fetch.statusCallback({ message: 'Downloading', current: 9, total: 10 })
    expect(host.statusMessage).toBe('Downloading')
    fetch.end()
    expect(host.statusMessage).toBeUndefined()
    expect(fetch.isCurrent()).toBe(false)
    clock += 100
    jest.advanceTimersByTime(100)
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  // A superseded run reaches its own `finally` too — it unwinds on the abort the
  // rotation raised — and clearing there would wipe the label belonging to the
  // fetch that replaced it.
  test('end() on a superseded fetch leaves the live one alone', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    const first = rotation.begin()
    const second = rotation.begin()
    second.statusCallback('Downloading')
    first.end()
    expect(host.statusMessage).toBe('Downloading')
    rotation.dispose()
  })

  // The replacing fetch's first status is a worker hop away, and nothing else
  // drops the label describing the work that was just abandoned.
  test('begin() clears the superseded fetch label', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host)
    rotation.begin().statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    rotation.begin()
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })
})

// A host composing `FetchMixin` already owns a throttle over the same status
// field. Handing the rotation its pair keeps the two fetches thinning through
// one window rather than two, which is the whole point of one-per-owner.
describe('a host that owns its own window', () => {
  test('reports through the host callback rather than a second throttle', () => {
    const seen: RpcStatus[] = []
    const flushed: string[] = []
    // stands in for FetchMixin: the sink and the flush are the model's, and the
    // rotation must reach for them instead of building its own
    const host = Model.actions(() => ({
      makeStatusCallback(isCurrent: () => boolean) {
        return (status: RpcStatus) => {
          if (isCurrent()) {
            seen.push(status)
          }
        }
      },
      flushStatus(apply: () => void) {
        flushed.push('flushed')
        apply()
      },
    })).create({})
    const rotation = createStopTokenRotation(host)
    const fetch = rotation.begin()
    fetch.statusCallback('Downloading')
    fetch.statusCallback('Parsing')
    // both landed: the host's window, not a second one thinning them here
    expect(seen).toEqual(['Downloading', 'Parsing'])
    fetch.end()
    expect(flushed.length).toBeGreaterThan(0)
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })
})
