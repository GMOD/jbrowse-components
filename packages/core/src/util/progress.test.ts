import {
  aggregateStatus,
  createProgressReporter,
  createStatusFanOut,
  createGuardedStatusSink,
  createStatusThrottle,
  downloadStatus,
  progressLabel,
  statusFraction,
  statusMessageText,
  statusProgressLabel,
  updateStatus,
  withProgress,
} from './progress.ts'

import type { RpcStatus } from './progress.ts'

describe('createProgressReporter', () => {
  it('auto-increments the counter when called with no argument', () => {
    const seen: number[] = []
    const report = createProgressReporter({
      label: 'x',
      total: 10,
      // capture the emitted current; throttleMs 0 so every gated call emits
      statusCallback: s => {
        if (typeof s === 'object') {
          seen.push(s.current)
        }
      },
      throttleMs: 0,
    })
    // throttleMs 0 so every call emits: the counter auto-increments from 0
    report()
    report()
    expect(seen).toEqual([0, 1])
  })

  it('emits on a slow, low-count phase (time-gated, not call-count-gated)', () => {
    // Regression: a phase with far fewer items than any call-count window but
    // heavy per-item work (e.g. a multi-sample VCF region: a few hundred sites,
    // thousands of samples each) must still tick the bar. An earlier bitmask
    // only consulted the clock every 1024 calls, so such a phase emitted only
    // the initial tick and the bar froze at 0%. Advance the clock past
    // throttleMs on each call and assert every call emits.
    const seen: number[] = []
    let now = 1_000_000
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      const report = createProgressReporter({
        label: 'Computing variant cells',
        total: 5,
        statusCallback: s => {
          if (typeof s === 'object') {
            seen.push(s.current)
          }
        },
        throttleMs: 100,
      })
      for (let i = 0; i < 5; i++) {
        now += 200 // heavy per-item work: 200ms elapses each iteration
        report(i)
      }
    } finally {
      spy.mockRestore()
    }
    expect(seen).toEqual([0, 1, 2, 3, 4])
  })

  it('throttles emits within throttleMs even across many calls', () => {
    // The time gate is the rate limiter: many rapid calls at the same clock
    // value collapse to a single emit.
    const seen: number[] = []
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => 1_000_000)
    try {
      const report = createProgressReporter({
        label: 'x',
        total: 100,
        statusCallback: s => {
          if (typeof s === 'object') {
            seen.push(s.current)
          }
        },
        throttleMs: 100,
      })
      for (let i = 0; i < 50; i++) {
        report(i)
      }
    } finally {
      spy.mockRestore()
    }
    expect(seen).toEqual([0])
  })

  it('honors an explicit current over the internal counter', () => {
    const seen: number[] = []
    const report = createProgressReporter({
      label: 'x',
      total: 100,
      statusCallback: s => {
        if (typeof s === 'object') {
          seen.push(s.current)
        }
      },
      throttleMs: 0,
    })
    report(0)
    expect(seen).toEqual([0])
  })

  it('honors a sparse explicit current (e.g. a running byte offset)', () => {
    const seen: number[] = []
    const report = createProgressReporter({
      label: 'x',
      total: 100,
      statusCallback: s => {
        if (typeof s === 'object') {
          seen.push(s.current)
        }
      },
      throttleMs: 0,
    })
    report(37)
    expect(seen).toEqual([37])
  })

  it('is a pure cancel-tick with no statusCallback', () => {
    const report = createProgressReporter({ total: 10 })
    expect(() => {
      report()
      report()
    }).not.toThrow()
  })
})

describe('createStatusThrottle', () => {
  let clock = 0
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('applies the first update, drops the rest of a burst', () => {
    const throttle = createStatusThrottle()
    const applied: number[] = []
    for (const n of [1, 2, 3]) {
      throttle.run(() => applied.push(n))
    }
    expect(applied).toEqual([1])
  })

  it('passes updates spaced beyond the window', () => {
    const throttle = createStatusThrottle()
    const applied: number[] = []
    throttle.run(() => applied.push(1))
    clock += 150
    throttle.run(() => applied.push(2))
    clock += 50
    throttle.run(() => applied.push(3))
    expect(applied).toEqual([1, 2])
  })

  it('reset reopens the window, so the next fetch reports at once', () => {
    const throttle = createStatusThrottle()
    const applied: number[] = []
    throttle.run(() => applied.push(1))
    clock += 10
    throttle.run(() => applied.push(2))
    throttle.reset()
    throttle.run(() => applied.push(3))
    expect(applied).toEqual([1, 3])
  })

  // one window per display, not per callback: N parallel per-region fetches
  // must thin to one stream between them rather than N
  it('separate throttles keep independent windows', () => {
    const a = createStatusThrottle()
    const b = createStatusThrottle()
    const applied: string[] = []
    a.run(() => applied.push('a'))
    b.run(() => applied.push('b'))
    expect(applied).toEqual(['a', 'b'])
  })

  // The last write of a phase is the one that matters most and is exactly the
  // one a leading-edge-only gate drops, which froze a determinate bar at
  // whatever percentage happened to land on a window boundary.
  it('delivers the last dropped write of a burst on the trailing edge', () => {
    jest.useFakeTimers()
    try {
      const throttle = createStatusThrottle()
      const applied: number[] = []
      for (const n of [1, 2, 3]) {
        throttle.run(() => applied.push(n))
      }
      expect(applied).toEqual([1])
      clock += 100
      jest.advanceTimersByTime(100)
      // 3, not 2: an older progress value is never what the user wants to see
      expect(applied).toEqual([1, 3])
    } finally {
      jest.useRealTimers()
    }
  })

  it('runNow lands immediately and cancels what was queued', () => {
    jest.useFakeTimers()
    try {
      const throttle = createStatusThrottle()
      const applied: (number | string)[] = []
      throttle.run(() => applied.push(1))
      throttle.run(() => applied.push(2))
      throttle.runNow(() => applied.push('clear'))
      expect(applied).toEqual([1, 'clear'])
      clock += 100
      jest.advanceTimersByTime(100)
      // the queued 2 is gone rather than landing after the clear
      expect(applied).toEqual([1, 'clear'])
    } finally {
      jest.useRealTimers()
    }
  })
})

// `''` is how every phase helper says "this phase is over". It has to land, and
// it has to cancel the progress value queued behind it — a trailing timer that
// put a percentage back on screen after the work ended is the regression the
// trailing edge would otherwise have introduced.
describe('createGuardedStatusSink', () => {
  let clock = 1_000_000
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('does not restore a queued progress value after the clear', () => {
    jest.useFakeTimers()
    try {
      const seen: RpcStatus[] = []
      const report = createGuardedStatusSink({
        isCurrent: () => true,
        sink: s => {
          seen.push(s)
        },
      })
      report({ message: 'Downloading', current: 1, total: 10 })
      report({ message: 'Downloading', current: 9, total: 10 })
      report('')
      expect(seen).toEqual([
        { message: 'Downloading', current: 1, total: 10 },
        '',
      ])
      clock += 100
      jest.advanceTimersByTime(100)
      expect(seen).toEqual([
        { message: 'Downloading', current: 1, total: 10 },
        '',
      ])
    } finally {
      jest.useRealTimers()
    }
  })

  // the guard is re-read inside the throttled body, because a trailing write
  // fires on a timer and the operation it belongs to can be gone by then
  it('drops a trailing write whose operation ended', () => {
    jest.useFakeTimers()
    try {
      let current = true
      const seen: RpcStatus[] = []
      const report = createGuardedStatusSink({
        isCurrent: () => current,
        sink: s => {
          seen.push(s)
        },
      })
      report('Downloading')
      report('Parsing')
      expect(seen).toEqual(['Downloading'])
      current = false
      clock += 100
      jest.advanceTimersByTime(100)
      expect(seen).toEqual(['Downloading'])
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('statusMessageText', () => {
  it('reads a plain string status', () => {
    expect(statusMessageText('Loading')).toBe('Loading')
  })
  it('reads the message off a determinate status', () => {
    expect(
      statusMessageText({ message: 'Downloading', current: 1, total: 2 }),
    ).toBe('Downloading')
  })
  it('is undefined for undefined', () => {
    expect(statusMessageText(undefined)).toBeUndefined()
  })
})

describe('statusFraction', () => {
  it('is undefined for an indeterminate (string) status', () => {
    expect(statusFraction('Loading')).toBeUndefined()
  })
  it('is undefined for undefined', () => {
    expect(statusFraction(undefined)).toBeUndefined()
  })
  it('is undefined when total is zero (avoids divide-by-zero)', () => {
    expect(
      statusFraction({ message: 'x', current: 0, total: 0 }),
    ).toBeUndefined()
  })
  it('returns current/total for a determinate status', () => {
    expect(statusFraction({ message: 'x', current: 1, total: 4 })).toBe(0.25)
  })
  it('clamps to 1 when current exceeds total', () => {
    expect(statusFraction({ message: 'x', current: 5, total: 4 })).toBe(1)
  })
})

describe('progressLabel', () => {
  it('is just the message when the fraction is undefined', () => {
    expect(progressLabel('Downloading', undefined)).toBe('Downloading')
  })
  it('appends a rounded percentage when a fraction is present', () => {
    expect(progressLabel('Downloading', 0.45)).toBe('Downloading 45%')
  })
  it('is just the percent when the message is empty', () => {
    expect(progressLabel('', 0.5)).toBe('50%')
    expect(progressLabel(undefined, 0.5)).toBe('50%')
  })
  it('is empty when both are absent', () => {
    expect(progressLabel(undefined, undefined)).toBe('')
  })
})

describe('statusProgressLabel', () => {
  it('is just the message for an indeterminate status', () => {
    expect(statusProgressLabel('Downloading')).toBe('Downloading')
  })
  it('appends a rounded percentage for a determinate status', () => {
    expect(
      statusProgressLabel({ message: 'Downloading', current: 45, total: 100 }),
    ).toBe('Downloading 45%')
  })
  it('rounds the percentage', () => {
    expect(
      statusProgressLabel({ message: 'Downloading', current: 1, total: 3 }),
    ).toBe('Downloading 33%')
  })
  it('is empty for undefined', () => {
    expect(statusProgressLabel(undefined)).toBe('')
  })
})

describe('updateStatus', () => {
  it('sets the label, runs fn, then clears with an empty string', async () => {
    const seen: RpcStatus[] = []
    const result = await updateStatus(
      'Working',
      s => seen.push(s),
      () => 42,
    )
    expect(result).toBe(42)
    expect(seen).toEqual(['Working', ''])
  })
  it('awaits an async fn', async () => {
    const seen: RpcStatus[] = []
    const result = await updateStatus(
      'Working',
      s => seen.push(s),
      () => Promise.resolve('done'),
    )
    expect(result).toBe('done')
    expect(seen).toEqual(['Working', ''])
  })
  it('is a no-op transport with no callback but still returns the result', async () => {
    expect(await updateStatus('Working', undefined, () => 7)).toBe(7)
  })
  // without the finally the label stayed on the channel, so the caller's error
  // surfaced under a stale "Downloading file"
  it('clears the label when fn throws', async () => {
    const seen: RpcStatus[] = []
    await expect(
      updateStatus(
        'Working',
        s => seen.push(s),
        () => Promise.reject(new Error('nope')),
      ),
    ).rejects.toThrow('nope')
    expect(seen).toEqual(['Working', ''])
  })
})

describe('downloadStatus', () => {
  it('labels the phase, hands fn a reporter, and clears when done', async () => {
    const seen: RpcStatus[] = []
    const result = await downloadStatus(
      'Downloading index',
      s => seen.push(s),
      onProgress => {
        onProgress!(30, 60)
        return 'ok'
      },
    )
    expect(result).toBe('ok')
    expect(seen).toEqual([
      'Downloading index',
      { message: 'Downloading index', current: 30, total: 60 },
      '',
    ])
  })
  it('emits just the label (indeterminate) when the reader reports no total', async () => {
    // generic-filehandle2 omits total when the response has no Content-Length:
    // the bar stays a spinner rather than rendering a bogus fraction
    const seen: RpcStatus[] = []
    await downloadStatus(
      'Downloading index',
      s => seen.push(s),
      onProgress => {
        onProgress!(1024)
      },
    )
    expect(seen).toEqual(['Downloading index', 'Downloading index', ''])
    expect(seen.every(s => typeof s === 'string')).toBe(true)
  })

  it('passes undefined reporter when there is no statusCallback', async () => {
    let received: unknown = 'unset'
    await downloadStatus('x', undefined, onProgress => {
      received = onProgress
    })
    expect(received).toBeUndefined()
  })
})

describe('withProgress', () => {
  it('reports 0% at start and clears at the end', async () => {
    const seen: RpcStatus[] = []
    const result = await withProgress(
      {
        label: 'Processing',
        total: 4,
        statusCallback: s => seen.push(s),
      },
      report => {
        report()
        return 'done'
      },
    )
    expect(result).toBe('done')
    // the kickoff report(0) emits at current 0; the final emit is the clear
    expect(seen[0]).toEqual({ message: 'Processing', current: 0, total: 4 })
    expect(seen.at(-1)).toBe('')
  })

  it('clears the label when fn throws', async () => {
    const seen: RpcStatus[] = []
    await expect(
      withProgress(
        { label: 'Processing', total: 4, statusCallback: s => seen.push(s) },
        () => Promise.reject(new Error('nope')),
      ),
    ).rejects.toThrow('nope')
    expect(seen.at(-1)).toBe('')
  })
})

describe('aggregateStatus', () => {
  it('returns undefined when nothing is in flight', () => {
    expect(aggregateStatus([])).toBeUndefined()
    expect(aggregateStatus([undefined, undefined])).toBeUndefined()
  })

  it('passes a lone string through unchanged', () => {
    expect(aggregateStatus(['Downloading'])).toBe('Downloading')
  })

  it('sums determinate statuses into one bar', () => {
    const agg = aggregateStatus([
      { message: 'Downloading', current: 30, total: 100 },
      { message: 'Downloading', current: 10, total: 100 },
    ])
    expect(agg).toEqual({ message: 'Downloading', current: 40, total: 200 })
    expect(statusFraction(agg)).toBeCloseTo(0.2)
  })

  it('charges an indeterminate status the mean of the known totals', () => {
    // the string status is a region still downloading with no Content-Length;
    // dropping it read as 50/100 — a half-full bar for a fetch that is really
    // only a quarter done, and 100% once that one region finished
    const agg = aggregateStatus([
      'Processing',
      { message: 'Downloading', current: 50, total: 100 },
    ])
    expect(agg).toEqual({ message: 'Downloading', current: 50, total: 200 })
  })

  it('cannot read complete while an indeterminate operation is in flight', () => {
    const agg = aggregateStatus([
      'Processing',
      { message: 'Downloading', current: 100, total: 100 },
    ])
    expect(statusFraction(agg)).toBeCloseTo(0.5)
  })

  it('falls back to the first message when all are indeterminate', () => {
    expect(statusMessageText(aggregateStatus(['Processing', 'Indexing']))).toBe(
      'Processing',
    )
  })

  it('does not let one region clobber another (no thrash)', () => {
    // region A at 90%, region B just started: aggregate reflects both, not B
    const agg = aggregateStatus([
      { message: 'Downloading', current: 90, total: 100 },
      { message: 'Downloading', current: 1, total: 100 },
    ])
    expect(statusFraction(agg)).toBeCloseTo(0.455)
  })
})

describe('createStatusFanOut', () => {
  it('sums concurrent slots into one bar rather than last-writer-wins', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => seen.push(s))
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 90, total: 100 })
    b({ message: 'Downloading', current: 10, total: 100 })
    expect(seen.at(-1)).toEqual({
      message: 'Downloading',
      current: 100,
      total: 200,
    })
  })

  it('keeps reporting the others when one slot finishes', () => {
    // the bug this exists for: a finished operation writes '' to clear its
    // phase, which used to blank the shared label while the rest ran on
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => seen.push(s))
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 100, total: 100 })
    b({ message: 'Downloading', current: 20, total: 100 })
    a('')
    expect(seen.at(-1)).toEqual({
      message: 'Downloading',
      current: 20,
      total: 100,
    })
  })

  it('clears once every slot is done', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => seen.push(s))
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 1, total: 2 })
    b('')
    a('')
    expect(seen.at(-1)).toBe('')
  })

  it('is inert without a downstream callback', () => {
    const slot = createStatusFanOut(undefined)
    expect(() => {
      slot()('Downloading')
    }).not.toThrow()
  })
})

// assembly.loadPre composes these two — a fan-out slot per concurrent file,
// behind one throttle — and then clears the status OUTSIDE the throttle. This
// pins why: the throttle has no trailing flush, so the retire that would have
// cleared the label is exactly the kind of write a burst swallows. Route that
// clear through the throttle to "tidy up" and the last "Downloading …" stays on
// screen after the load finishes, with nothing else failing.
describe('a throttled fan-out needs an unthrottled clear', () => {
  let clock = 0
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('swallows the final clear when it goes through the throttle', () => {
    const seen: RpcStatus[] = []
    const throttle = createStatusThrottle()
    const slot = createStatusFanOut(s => {
      throttle.run(() => seen.push(s))
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 1, total: 2 })
    b({ message: 'Downloading', current: 1, total: 2 })
    a('')
    b('')
    // every write after the first landed inside the same 100ms window
    expect(seen).toEqual([{ message: 'Downloading', current: 1, total: 2 }])
    expect(seen.at(-1)).not.toBe('')
  })
})
