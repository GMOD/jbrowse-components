import { types } from '@jbrowse/mobx-state-tree'

import {
  createStatusChannel,
  createStopTokenRotation,
} from './createStopTokenRotation.ts'
import { createStatusWindow } from './progress.ts'
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

  // The window reopens when the field goes idle, not on every supersede: a
  // fetch starting after a lull is the case that would otherwise be charged a
  // window it did nothing to earn, while a rapid pan superseding a fetch every
  // few milliseconds is exactly the burst the throttle is for.
  test('a fetch starting after a lull reports its first status at once', () => {
    const host = makeHost()
    const rotation = createStopTokenRotation(host, host)
    const first = rotation.begin()
    first.statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    first.end()
    // same tick, and the field is idle again, so this lands rather than waiting
    // out the rest of the window the first fetch opened
    rotation.begin().statusCallback('Parsing')
    expect(host.statusMessage).toBe('Parsing')
    rotation.dispose()
  })

  // The guard makes a late write a no-op rather than a write to a dead node, but
  // the timer itself still stands for up to a window past teardown.
  test('dispose() retires the open slot and drops a queued trailing write', () => {
    jest.useFakeTimers()
    const host = makeHost()
    const rotation = createStopTokenRotation(host, host)
    const { statusCallback } = rotation.begin()
    statusCallback('Downloading')
    // same tick, so this one is queued on the trailing timer
    statusCallback('Parsing')
    // a fetch in flight when the host is torn down never reaches its `finally`
    rotation.dispose()
    expect(host.statusMessage).toBeUndefined()
    expect(jest.getTimerCount()).toBe(0)
    clock += 100
    jest.advanceTimersByTime(100)
    expect(host.statusMessage).toBeUndefined()
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
    const first = rotation.begin()
    first.statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    const second = rotation.begin()
    // the superseded fetch's `finally`, a microtask behind the abort it unwinds
    // on and so always after the replacement has opened its own slot
    first.end()
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
    const first = rotation.begin()
    first.statusCallback('Downloading')
    // same tick, so this one is queued on the trailing timer
    first.statusCallback({ message: 'Downloading', current: 9, total: 10 })
    const second = rotation.begin()
    first.end()
    second.statusCallback('Parsing')
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

// A host composing `FetchMixin` already owns a window over the same status
// field. Lending it to the rotation makes this fetch one slot beside the host's
// others rather than a second writer, which is what one-per-owner is for — and
// lending the window rather than a pair of callbacks is what makes reporting
// through one and clearing another unspellable.
//
// Shaped exactly like `FetchMixin`, down to the volatile initializer reaching
// forward for an action three chain steps away, because that is the only host
// that lends.
const LendingModel = types
  .model('LendingRotationHost', {})
  .volatile(self => ({
    statusMessage: undefined as RpcStatus | undefined,
    statusWindow: createStatusWindow(status => {
      ;(
        self as unknown as { setStatusMessage: (status?: RpcStatus) => void }
      ).setStatusMessage(status)
    }),
  }))
  .actions(self => ({
    setStatusMessage(status?: RpcStatus) {
      self.statusMessage = status
    },
  }))

describe('a host that owns its own window', () => {
  function lendingHost() {
    const host = LendingModel.create({})
    // the window alone, the way `FetchMixin` passes it: the lending arm of
    // `StatusReporter` takes no `setStatusMessage`, because it never calls one
    return {
      host,
      rotation: createStopTokenRotation(host, {
        statusWindow: host.statusWindow,
      }),
    }
  }

  test('reports through the host window, not a second one', () => {
    const { host, rotation } = lendingHost()
    const other = host.statusWindow.open({ isCurrent: () => true })
    const fetch = rotation.begin()
    // the rotation's own slot and a sibling on the same window share one
    // throttle: the sibling's write falls inside the window this one just
    // opened, and what lands is the two of them aggregated
    fetch.statusCallback('Downloading')
    other.statusCallback('from the region fetches')
    expect(host.statusMessage).toBe('Downloading')
    fetch.end()
    other.clear()
    rotation.dispose()
  })

  // The defect ADR-081 is about. `end()` used to blank the shared field
  // outright, so a bare-autorun fetch finishing wiped the label the display's
  // region fetches were still producing — and the overlay renders a missing
  // label as its 'Loading' fallback, so it read as a flash of "Loading" inside
  // a load that never stopped.
  test('ending does not blank a label a sibling operation is still writing', () => {
    const { host, rotation } = lendingHost()
    const sibling = host.statusWindow.open({ isCurrent: () => true })
    const fetch = rotation.begin()
    sibling.statusCallback('Downloading features')
    fetch.end()
    expect(host.statusMessage).toBe('Downloading features')
    // and the last operation to finish is the one that blanks it
    sibling.clear()
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  test('ending blanks the field when nothing else is reporting', () => {
    const { host, rotation } = lendingHost()
    const fetch = rotation.begin()
    fetch.statusCallback('Downloading')
    expect(host.statusMessage).toBe('Downloading')
    fetch.end()
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })

  // A superseded run reaches its `finally` too, and its slot goes on voting for
  // the phase it stopped in until it retires. The replacement has opened its own
  // slot by then, so the label survives the handover either way.
  test('a superseded run retires its slot without blanking the field', () => {
    const { host, rotation } = lendingHost()
    const first = rotation.begin()
    first.statusCallback('Downloading')
    const second = rotation.begin()
    first.end()
    expect(host.statusMessage).toBe('Downloading')
    second.end()
    expect(host.statusMessage).toBeUndefined()
    rotation.dispose()
  })
})
