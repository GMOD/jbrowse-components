import { types } from '@jbrowse/mobx-state-tree'

import {
  createStatusChannel,
  createStopTokenRotation,
} from './createStopTokenRotation.ts'
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

// the display case: the node and the reporter are the same object, because a
// display's status fields are part of its own API
function hostAndReporter() {
  const host = makeHost()
  return [host, host] as const
}

test('begin() stops the fetch it supersedes and un-currents its guard', () => {
  const rotation = createStopTokenRotation(...hostAndReporter())
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
  const rotation = createStopTokenRotation(...hostAndReporter())
  const { stopToken } = rotation.begin()
  expect(isStopped(stopToken)).toBe(false)
  rotation.dispose()
  expect(isStopped(stopToken)).toBe(true)
})

test('dispose() is safe when no fetch ever began', () => {
  expect(() => {
    createStopTokenRotation(...hostAndReporter()).dispose()
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
    const rotation = createStopTokenRotation(host, host)
    const first = rotation.begin()
    rotation.begin()
    first.statusCallback('Downloading')
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  test('each fetch reopens the window, so its first status lands at once', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host, host)
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
    const rotation = createStopTokenRotation(host, host)
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
    const rotation = createStopTokenRotation(host, host)
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
    const rotation = createStopTokenRotation(host, host)
    const first = rotation.begin()
    const second = rotation.begin()
    second.statusCallback('Downloading')
    first.end()
    expect(host.statusMessage).toBe('Downloading')
    rotation.dispose()
  })

  // A superseded fetch is the one case where the display does not stop loading,
  // and the loading overlay renders a missing label as its 'Loading' fallback —
  // so clearing here flashed "Loading" between every pan and the phase the view
  // was already in. The replacing fetch's first status is a worker hop away, and
  // the phase it is about to re-enter is the one already on screen. ADR-080.
  test('begin() keeps the superseded fetch label, and end() clears it', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host, host)
    rotation.begin().statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    const second = rotation.begin()
    expect(host.statusMessage).toBe('Downloading')
    second.end()
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  // The other half of not clearing: the outgoing fetch's queued trailing write
  // must still be dropped, or a percentage from work that was abandoned lands
  // on top of the incoming fetch's own first status a window later.
  test('begin() drops the write the superseded fetch left queued', () => {
    jest.useFakeTimers()
    const host = makeHost()
    const rotation = createStopTokenRotation(host, host)
    const { statusCallback } = rotation.begin()
    statusCallback('Downloading')
    // same tick, so this one is queued on the trailing timer
    statusCallback({ message: 'Downloading', current: 9, total: 10 })
    rotation.begin().statusCallback('Parsing')
    clock += 100
    jest.advanceTimersByTime(100)
    expect(host.statusMessage).toBe('Parsing')
    rotation.dispose()
  })
})

// The one-field case: a view with one operation to narrate holds a channel
// instead of declaring the message/fraction/setter trio a display does.
describe('createStatusChannel', () => {
  test('is a reporter a model can hold in a single volatile', () => {
    const host = makeHost()
    const channel = createStatusChannel()
    const rotation = createStopTokenRotation(host, channel)
    const fetch = rotation.begin()
    fetch.statusCallback({ message: 'Downloading', current: 1, total: 4 })
    expect(channel.message).toBe('Downloading')
    expect(channel.fraction).toBe(0.25)
    // and the node's own fields are untouched — the point of passing a channel
    expect(host.statusMessage).toBeUndefined()
    fetch.end()
    expect(channel.message).toBeUndefined()
    expect(channel.fraction).toBeUndefined()
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
    const rotation = createStopTokenRotation(host, host)
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
