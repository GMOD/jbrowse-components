import {
  aggregateStatus,
  createProgressReporter,
  createStatusFanOut,
  createStatusWindow,
  downloadStatus,
  progressLabel,
  statusFraction,
  statusMessageText,
  statusProgressLabel,
  updateStatus,
  withProgress,
} from './progress.ts'
import { markStopTokenStopped } from './stopToken.ts'

import type { RpcStatus, StatusCallback } from './progress.ts'

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

describe('createStatusWindow', () => {
  let clock = 0
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // a live stream on a fresh window: the shape every one of these cases wants,
  // and the shape a caller can no longer get wrong by opening a window per
  // stream, or by taking a callback without the clear that ends it
  function openStream() {
    const seen: (RpcStatus | undefined)[] = []
    const statusWindow = createStatusWindow()
    const guard = { current: true }
    const { statusCallback: report, clear } = statusWindow.open({
      isCurrent: () => guard.current,
      write: s => {
        seen.push(s)
      },
    })
    return { seen, statusWindow, report, clear, guard }
  }

  it('writes the first status of a burst and drops the rest', () => {
    const { seen, report } = openStream()
    for (const n of ['1', '2', '3']) {
      report(n)
    }
    expect(seen).toEqual(['1'])
  })

  it('passes statuses spaced beyond the window', () => {
    const { seen, report } = openStream()
    report('1')
    clock += 150
    report('2')
    clock += 50
    report('3')
    expect(seen).toEqual(['1', '2'])
  })

  it('reset reopens the window, so the next fetch reports at once', () => {
    const { seen, statusWindow, report } = openStream()
    report('1')
    clock += 10
    report('2')
    statusWindow.reset()
    report('3')
    expect(seen).toEqual(['1', '3'])
  })

  // one window per owner, not per callback: N parallel per-region fetches must
  // thin to one stream between them rather than N, which is the whole reason
  // the sinks come off the window rather than taking one as an argument
  it('thins every stream on one window to one flow between them', () => {
    const seen: (RpcStatus | undefined)[] = []
    const statusWindow = createStatusWindow()
    const isCurrent = () => true
    const write = (s: RpcStatus | undefined) => {
      seen.push(s)
    }
    const a = statusWindow.open({ isCurrent, write })
    const b = statusWindow.open({ isCurrent, write })
    a.statusCallback('from a')
    b.statusCallback('from b')
    expect(seen).toEqual(['from a'])
  })

  it('keeps separate windows independent', () => {
    const a = openStream()
    const b = openStream()
    a.report('from a')
    b.report('from b')
    expect(a.seen).toEqual(['from a'])
    expect(b.seen).toEqual(['from b'])
  })

  // The last write of a phase is the one that matters most and is exactly the
  // one a leading-edge-only gate drops, which froze a determinate bar at
  // whatever percentage happened to land on a window boundary.
  it('delivers the last dropped write of a burst on the trailing edge', () => {
    jest.useFakeTimers()
    try {
      const { seen, report } = openStream()
      for (const n of ['1', '2', '3']) {
        report(n)
      }
      expect(seen).toEqual(['1'])
      clock += 100
      jest.advanceTimersByTime(100)
      // 3, not 2: an older progress value is never what the user wants to see
      expect(seen).toEqual(['1', '3'])
    } finally {
      jest.useRealTimers()
    }
  })

  // The stream's last word, and the reason it comes back beside the callback:
  // the shared bar's design rests on every owner blanking its own field when its
  // work ends, and a fan-out cannot see the end of a batch (ADR-080).
  it('clear blanks the field immediately and cancels what was queued', () => {
    jest.useFakeTimers()
    try {
      const { seen, report, clear } = openStream()
      report('1')
      report('2')
      clear()
      expect(seen).toEqual(['1', undefined])
      clock += 100
      jest.advanceTimersByTime(100)
      // the queued 2 is gone rather than landing after the clear
      expect(seen).toEqual(['1', undefined])
    } finally {
      jest.useRealTimers()
    }
  })

  // A run that has just finished is no longer current, and closing the guard
  // before clearing is how an owner stops a still-running sibling from writing
  // over the clear — `assembly.loadPre` does exactly that.
  it('clear lands even once the guard has closed', () => {
    const { seen, report, clear, guard } = openStream()
    report('Downloading')
    guard.current = false
    clear()
    expect(seen).toEqual(['Downloading', undefined])
  })

  // `''` is how every phase helper says "this phase is over", and it is thinned
  // like every other status. What has to hold is that it CANCELS the progress
  // value queued behind it, so a finished phase's percentage can never come back
  // on screen; landing on the leading edge was never part of that, and exempting
  // it is what left every phase boundary unthrottled.
  it('does not restore a queued progress value after the clear', () => {
    jest.useFakeTimers()
    try {
      const { seen, report } = openStream()
      report({ message: 'Downloading', current: 1, total: 10 })
      report({ message: 'Downloading', current: 9, total: 10 })
      report('')
      // the 9/10 and the '' both fell inside the first write's window, and the
      // window holds exactly one pending write — so the '' displaced the
      // percentage rather than queueing behind it
      expect(seen).toEqual([{ message: 'Downloading', current: 1, total: 10 }])
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

  // The reason the clear is thinned with everything else. A phase boundary is a
  // close immediately followed by the next phase's open, so a clear on the
  // leading edge handed every boundary a free pass and the window applied to
  // nothing that mattered. `executeRenderFeatureData` closes three phases in the
  // last few ms of a warm fetch: the overlay repainted five times inside those
  // ms — label, blank, a 0% bar, blank, label — and none of the five was up long
  // enough to read.
  it('paints nothing for phases that open and close inside one window', () => {
    jest.useFakeTimers()
    try {
      const { seen, report } = openStream()
      report('Downloading features')
      // the tail of a warm fetch, all of it inside the first write's window
      report('')
      report({ message: 'Computing layout', current: 0, total: 300 })
      report('')
      report('Collecting render data')
      report('')
      expect(seen).toEqual(['Downloading features'])
      clock += 100
      jest.advanceTimersByTime(100)
      // one trailing write, and it is the newest — never the 0% bar
      expect(seen).toEqual(['Downloading features', ''])
    } finally {
      jest.useRealTimers()
    }
  })

  // the guard is re-read inside the throttled body, because a trailing write
  // fires on a timer and the operation it belongs to can be gone by then
  it('drops a trailing write whose operation ended', () => {
    jest.useFakeTimers()
    try {
      const { seen, report, guard } = openStream()
      report('Downloading')
      report('Parsing')
      expect(seen).toEqual(['Downloading'])
      guard.current = false
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

// The clear used to be absolute, so an inner phase blanked its caller's label
// for the whole rest of the caller's work. The rule was "run phases in
// sequence, or give the inner one no statusCallback" — a rule about code two
// files away from the call site, which is one waiting to be broken.
describe('phases nest', () => {
  it('restores the enclosing label instead of blanking it', async () => {
    const seen: RpcStatus[] = []
    const cb = (s: RpcStatus) => {
      seen.push(s)
    }
    await updateStatus('Loading track', cb, async () => {
      await updateStatus('Downloading index', cb, () => 1)
      await updateStatus('Parsing', cb, () => 2)
    })
    expect(seen).toEqual([
      'Loading track',
      'Downloading index',
      'Loading track',
      'Parsing',
      'Loading track',
      '',
    ])
  })

  it('restores it when the inner phase throws', async () => {
    const seen: RpcStatus[] = []
    const cb = (s: RpcStatus) => {
      seen.push(s)
    }
    await expect(
      updateStatus('Loading track', cb, () =>
        updateStatus('Downloading index', cb, () =>
          Promise.reject(new Error('404')),
        ),
      ),
    ).rejects.toThrow('404')
    // the outer phase's own finally then closes it — the point is that the
    // inner one did not blank it on the way past
    expect(seen).toEqual([
      'Loading track',
      'Downloading index',
      'Loading track',
      '',
    ])
  })

  it('nests a determinate phase inside an indeterminate one', async () => {
    const seen: RpcStatus[] = []
    const cb = (s: RpcStatus) => {
      seen.push(s)
    }
    await updateStatus('Loading track', cb, () =>
      withProgress(
        { label: 'Parsing', total: 2, statusCallback: cb },
        () => undefined,
      ),
    )
    expect(seen).toEqual([
      'Loading track',
      { message: 'Parsing', current: 0, total: 2 },
      'Loading track',
      '',
    ])
  })

  // two phases on ONE channel, settling in the order they did not start in — a
  // Promise.all handed the same callback. A LIFO pop retires the wrong entry
  // and the survivor's label is the one that goes missing.
  it('a phase closing out of order retires its own entry', async () => {
    const seen: RpcStatus[] = []
    const cb = (s: RpcStatus) => {
      seen.push(s)
    }
    let releaseFirst = () => {}
    const first = updateStatus(
      'Downloading alignments',
      cb,
      () =>
        new Promise<void>(resolve => {
          releaseFirst = resolve
        }),
    )
    const second = updateStatus('Downloading sequence', cb, () => undefined)
    await second
    // the still-running phase's label, not a blank and not the finished one's
    expect(seen.at(-1)).toBe('Downloading alignments')
    releaseFirst()
    await first
    expect(seen.at(-1)).toBe('')
  })

  // the enclosing phase is what a nested clear restores; with nothing enclosing
  // it, `''` is still what closes the channel, which every consumer downstream
  // reads as "this phase is over"
  it('still closes the outermost phase with an empty string', async () => {
    const seen: RpcStatus[] = []
    await updateStatus(
      'Working',
      s => {
        seen.push(s)
      },
      () => undefined,
    )
    expect(seen.at(-1)).toBe('')
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

  // The kickoff `report(0)` checks the stop token before it emits, so a token
  // already stopped throws there rather than out of the work — and outside the
  // try that threw straight past the close, leaving the phase open on the
  // channel. Its cost is not the missing `''`: a slot whose last word is a
  // label is one aggregateStatus counts as in flight for the rest of the batch,
  // so one cancelled region pinned the shared bar to a phase nothing was in.
  //
  // A string token because that is the path a deployment without cross-origin
  // isolation takes, and the only one whose check fires on the first call — a
  // SharedArrayBuffer token reads its atomic once every 10.
  it('closes its phase when the token was stopped before it started', async () => {
    const seen: RpcStatus[] = []
    const cb = (s: RpcStatus) => {
      seen.push(s)
    }
    const stopToken = 'blob:stopped-before-withProgress'
    markStopTokenStopped(stopToken)
    await updateStatus('Downloading features', cb, async () => {
      await expect(
        withProgress(
          {
            label: 'Computing layout',
            total: 2,
            statusCallback: cb,
            stopToken,
          },
          () => {},
        ),
      ).rejects.toThrow()
    })
    expect(seen).toEqual(['Downloading features', 'Downloading features', ''])
  })
})

describe('aggregateStatus', () => {
  // the slot shape with no finished phases: these cases are about the in-flight
  // reading, and the finished half is exercised through createStatusFanOut below
  const aggOf = (statuses: (RpcStatus | undefined)[]) =>
    aggregateStatus(statuses.map(status => ({ status, completed: new Map() })))
  it('returns undefined when nothing is in flight', () => {
    expect(aggOf([])).toBeUndefined()
    expect(aggOf([undefined, undefined])).toBeUndefined()
  })

  it('passes a lone string through unchanged', () => {
    expect(aggOf(['Downloading'])).toBe('Downloading')
  })

  it('sums determinate statuses into one bar', () => {
    const agg = aggOf([
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
    const agg = aggOf([
      'Processing',
      { message: 'Downloading', current: 50, total: 100 },
    ])
    expect(agg).toEqual({ message: 'Downloading', current: 50, total: 200 })
  })

  it('cannot read complete while an indeterminate operation is in flight', () => {
    const agg = aggOf([
      'Processing',
      { message: 'Downloading', current: 100, total: 100 },
    ])
    expect(statusFraction(agg)).toBeCloseTo(0.5)
  })

  it('falls back to the first message when all are indeterminate', () => {
    expect(statusMessageText(aggOf(['Processing', 'Indexing']))).toBe(
      'Processing',
    )
  })

  it('does not let one region clobber another (no thrash)', () => {
    // region A at 90%, region B just started: aggregate reflects both, not B
    const agg = aggOf([
      { message: 'Downloading', current: 90, total: 100 },
      { message: 'Downloading', current: 1, total: 100 },
    ])
    expect(statusFraction(agg)).toBeCloseTo(0.455)
  })

  // ADR-072. The regions of one fan-out cross phase boundaries at different
  // times, and the phases do not measure the same thing: the canvas RPC
  // downloads bytes and then lays out features, so a summed bar was scaled by
  // whichever slot happened to hold the bigger raw total. 400kb of bytes beside
  // 300 features put the layout region's real progress three orders of magnitude
  // below the noise floor.
  it('does not sum across phases that measure different things', () => {
    const downloading = {
      message: 'Downloading features',
      current: 0,
      total: 400_000,
    }
    const layingOut = { message: 'Computing layout', current: 150, total: 300 }
    // one of each: the tie breaks to the earliest, and the other is charged as
    // unmeasured rather than summed — 0 of 400000 doubled, not 150/400300
    expect(aggOf([downloading, layingOut])).toEqual({
      message: 'Downloading features',
      current: 0,
      total: 800_000,
    })
    // the majority phase wins, so three downloading regions are not repriced by
    // the one that has moved on
    expect(
      statusFraction(
        aggOf([
          { ...downloading, current: 200_000 },
          { ...downloading, current: 200_000 },
          { ...downloading, current: 200_000 },
          layingOut,
        ]),
      ),
    ).toBeCloseTo(0.375)
  })

  // The same defect from the other side. Summed, the pair below read 99.7%
  // complete — a bar almost full because the byte slot's total dwarfed the
  // feature slot's, not because the work was nearly done. It now reads half,
  // which is what one of two regions finished actually means.
  //
  // The drop to 0% when that slot retires is NOT the defect and does not go
  // away: a bar over in-flight work alone loses its denominator as operations
  // finish. See the `''` note on aggregateStatus — charging a retired slot is
  // the alternative, and it makes the bar run backwards instead.
  it('is not scaled by the largest unit in another phase', () => {
    const layingOut = { message: 'Computing layout', current: 0, total: 300 }
    const nearlyDownloaded = {
      message: 'Downloading features',
      current: 399_000,
      total: 400_000,
    }
    expect(statusFraction(aggOf([nearlyDownloaded, layingOut]))).toBeCloseTo(
      0.499,
    )
    expect(statusFraction(aggOf(['', layingOut]))).toBeCloseTo(0)
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
    // a's 100 stays in both halves, so the reading is what it was the instant
    // before it retired. Dropping it read 20/100 — the same 20% of work, priced
    // as if a had never been asked for
    expect(seen.at(-1)).toEqual({
      message: 'Downloading',
      current: 120,
      total: 200,
    })
  })

  // what the drop actually looked like: four regions of 1000, three landed and
  // the fourth halfway, read 50% right after reading 87.5%
  it('never runs backwards as the batch lands', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => seen.push(s))
    const slots = Array.from({ length: 4 }, () => slot())
    for (const s of slots) {
      s({ message: 'Downloading', current: 500, total: 1000 })
    }
    for (const s of slots.slice(0, 3)) {
      s({ message: 'Downloading', current: 1000, total: 1000 })
      s('')
    }

    const fractions = seen.map(statusFraction).filter(f => f !== undefined)
    for (const [i, f] of fractions.entries()) {
      expect(f).toBeGreaterThanOrEqual(fractions[i - 1] ?? 0)
    }
    expect(seen.at(-1)).toEqual({
      message: 'Downloading',
      current: 3500,
      total: 4000,
    })
  })

  // a slot moving to its next phase is not a slot that finished the batch, and
  // the phases are incommensurable anyway — bytes summed with features is the
  // reading ADR-072 removed
  it('does not charge a finished phase against a different one', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => seen.push(s))
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 400, total: 400 })
    a('')
    a({ message: 'Computing layout', current: 1, total: 4 })
    b({ message: 'Computing layout', current: 1, total: 4 })
    expect(seen.at(-1)).toEqual({
      message: 'Computing layout',
      current: 2,
      total: 8,
    })
  })

  // A slot between two phases reads exactly like a slot that is done, so an
  // empty aggregate cannot mean "the batch is over". Writing it anyway blanked
  // the shared label mid-batch, and the loading UI renders a blank label as
  // "Loading" — the flap between "Loading" and "Downloading features" that a
  // two-region GFF3 fetch showed on every phase boundary the regions crossed
  // together. The owner's own clear is what ends the stream.
  it('never writes the empty status, even once every slot is done', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 1, total: 2 })
    b('')
    a('')
    expect(seen.every(s => s !== '')).toBe(true)
    // the label alone: nothing is in flight at all, so the bar is over — this is
    // the case a held reading must NOT survive into, unlike the gap between one
    // slot's reads below. It displaces the queued percentage rather than
    // blanking the field, and the owner's own clear ends the stream
    expect(seen.at(-1)).toBe('Downloading')
  })

  // What a "Downloading features" that blinks actually is: between a slot's
  // reads it reports the label alone, and when every slot is between reads at
  // once the aggregate has no measurement — so the bar dropped to an
  // indeterminate spinner and came back a tick later. Three blocks doing their
  // redispatch flanks did that seven times in two seconds.
  it('does not lose the bar when no slot is measuring the phase', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading features', current: 900, total: 1000 })
    b({ message: 'Downloading features', current: 900, total: 1000 })
    // both cross into their next read at once, reporting the enclosing label
    a('Downloading features')
    b('Downloading features')
    // a's read is credited in full as it retires, so the last reading is 0.95 —
    // the point is that there IS one, where the bar used to vanish
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.95)
    expect(seen.every(s => typeof s === 'object')).toBe(true)
  })

  // Every slot between its reads at once is what makes a full aggregate, and the
  // next read starting is what takes it away again — so the bar toggled 100/98.
  it('does not read complete while a slot is still in flight', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading features', current: 500, total: 1000 })
    b({ message: 'Downloading features', current: 1000, total: 1000 })
    // a retires its read; both are now credited in full and nothing is measuring
    a('Downloading features')
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.75)
    // a's flank opens, and the fraction that comes back is not a step down from
    // a 100% that was never true
    a({ message: 'Downloading features', current: 0, total: 100 })
    expect(statusFraction(seen.at(-1))).toBeCloseTo(2000 / 2100)
  })

  it('drops the held bar when the phase changes', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    a({ message: 'Downloading features', current: 900, total: 1000 })
    a('Computing layout')
    expect(seen.at(-1)).toBe('Computing layout')
  })

  // The shape the canvas feature RPC actually runs: the adapter's byte-counted
  // "Downloading features" nests inside the RPC's own phase of the same name, so
  // the download closes onto that enclosing label rather than onto `''`. Only
  // `''` used to retire a phase, so every region's bytes left both halves of the
  // fraction the instant its download finished and the bar fell back.
  it('retires a phase that closes onto an enclosing label, not just on empty', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading features', current: 1000, total: 1000 })
    b({ message: 'Downloading features', current: 500, total: 1000 })
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.75)
    // a's download ends; the enclosing phase of the same name is what it lands on
    a('Downloading features')
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.75)
    b({ message: 'Downloading features', current: 750, total: 1000 })
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.875)
  })

  // A region read twice (tabix redispatches when a feature overhangs the query)
  // reports a second "Downloading features" starting at zero. The first read's
  // bytes are finished work, not a measurement to overwrite.
  it('retires a phase that restarts under the same label', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    a({ message: 'Downloading features', current: 1000, total: 1000 })
    a({ message: 'Downloading features', current: 0, total: 1000 })
    expect(seen.at(-1)).toEqual({
      message: 'Downloading features',
      current: 1000,
      total: 2000,
    })
  })

  // The double charge: a slot that finished the winning phase and moved on was
  // counted at its full total AND charged the mean as an unmeasured operation on
  // top, so the bar dropped every time a region crossed into its next phase.
  it('does not charge a finished phase the unmeasured mean as well', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 1000, total: 1000 })
    b({ message: 'Downloading', current: 900, total: 1000 })
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.95)
    a({ message: 'Computing layout', current: 0, total: 50 })
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.95)
  })

  // Which phase a slot is IN is what it last reported; which phase it is
  // MEASURING is empty for as long as it sits between two reads. Voting on the
  // second let the downloading region drop out of its own phase's count every
  // time it crossed a read boundary, so a two-region batch one phase apart tied
  // 1-1 and then 1-0 and back — the label and the whole denominator under it
  // swapping several times a second.
  it('does not flap while one region lays out and the other is between reads', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a({ message: 'Downloading features', current: 0, total: 1000 })
    b({ message: 'Downloading features', current: 0, total: 9000 })
    a({ message: 'Downloading features', current: 1000, total: 1000 })
    // a's download closes onto the enclosing label and a moves on to layout,
    // while b keeps downloading with a gap between each read
    a('Downloading features')
    a({ message: 'Computing layout', current: 0, total: 50 })
    b({ message: 'Downloading features', current: 4000, total: 9000 })
    b('Downloading features')
    a({ message: 'Computing layout', current: 10, total: 50 })
    b({ message: 'Downloading features', current: 0, total: 5000 })
    a({ message: 'Computing layout', current: 20, total: 50 })

    const messages = seen.map(statusMessageText)
    expect(messages.every(m => m === 'Downloading features')).toBe(true)
    const fractions = seen.map(statusFraction).filter(f => f !== undefined)
    for (const [i, f] of fractions.entries()) {
      expect(f).toBeGreaterThanOrEqual(fractions[i - 1] ?? 0)
    }
  })

  // A batch leaves a phase when its LAST slot does, not when a majority has. On
  // a count the label changed hands as the regions crossed and changed back as
  // they finished: three regions of different sizes produced "Downloading
  // features" → "Computing layout" → "Downloading features" → "Computing
  // layout" in one ordinary fetch. Nothing about that stream is false, and it
  // reads as the load restarting.
  //
  // The bar under it is the phase's own: the three finished regions count in
  // full, so it rises toward the straggler rather than being repriced by it.
  it('holds the phase until the last region leaves it', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const slots = [slot(), slot(), slot(), slot()]
    for (const s of slots) {
      s({ message: 'Downloading features', current: 0, total: 1000 })
    }
    for (const s of slots.slice(0, 3)) {
      s({ message: 'Downloading features', current: 1000, total: 1000 })
      s('Downloading features')
      s({ message: 'Computing layout', current: 1, total: 10 })
    }
    expect(statusMessageText(seen.at(-1))).toBe('Downloading features')
    // three of four regions' bytes are in, and the fourth is what is left
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.75)
    // and the last one leaving is what moves the label on, once
    slots[3]!({ message: 'Downloading features', current: 1000, total: 1000 })
    slots[3]!('Downloading features')
    slots[3]!({ message: 'Computing layout', current: 1, total: 10 })
    expect(statusMessageText(seen.at(-1))).toBe('Computing layout')
    const labels = seen.map(statusMessageText)
    expect(labels.lastIndexOf('Downloading features')).toBeLessThan(
      labels.indexOf('Computing layout'),
    )
  })

  // What separates a phase a region is still working through from one it has
  // merely announced: whether this batch has ever measured it. Ranking on first
  // appearance alone would hand the label — and the bar under it — to the region
  // still sizing its region, over the one already reporting bytes.
  it('does not let a phase with nothing to measure hold the label', () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const a = slot()
    const b = slot()
    a('Checking region size')
    b('Checking region size')
    a({ message: 'Downloading features', current: 100, total: 1000 })
    expect(statusMessageText(seen.at(-1))).toBe('Downloading features')
    // b is charged the mean rather than dropped, so one of two regions a tenth
    // of the way through its bytes is not a bar at 10%
    expect(statusFraction(seen.at(-1))).toBeCloseTo(0.05)
  })

  // Assembled from the real helpers rather than hand-written statuses, because
  // the shape that broke this is one no hand-written case had: the canvas
  // feature RPC opens "Downloading features" and the adapter opens its own
  // byte-counted phase of the same name inside it, so a region's download closes
  // onto that enclosing label instead of onto `''`. Two regions share the
  // fan-out, and every phase boundary either one crosses used to drop its bytes
  // out of the fraction and blank the shared label.
  it('reads as one rising bar across the shape the canvas fetch runs', async () => {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const region = async (cb: StatusCallback, bytes: number) => {
      await updateStatus('Downloading features', cb, () =>
        downloadStatus('Downloading features', cb, async onProgress => {
          for (let i = 1; i <= 4; i++) {
            await Promise.resolve()
            onProgress?.((bytes * i) / 4, bytes)
          }
        }),
      )
      await withProgress(
        { label: 'Computing layout', total: 2, statusCallback: cb },
        async report => {
          for (let i = 0; i < 2; i++) {
            await Promise.resolve()
            report()
          }
        },
      )
    }
    await Promise.all([region(slot(), 1000), region(slot(), 3000)])

    expect(seen).not.toContain('')
    const downloading = seen.filter(
      s => statusMessageText(s) === 'Downloading features',
    )
    const fractions = downloading
      .map(statusFraction)
      .filter(f => f !== undefined)
    for (const [i, f] of fractions.entries()) {
      expect(f).toBeGreaterThanOrEqual(fractions[i - 1] ?? 0)
    }
    // never reads complete: the aggregate exists only while a slot is in flight,
    // and every slot being between reads is what makes a full one
    expect(fractions.at(-1)).toBeGreaterThan(0.8)
    expect(fractions.every(f => f < 1)).toBe(true)
    // and the label moves forward with the batch: these two regions cross
    // together, so nothing reads as downloading once either is laying out
    const messages = seen.map(statusMessageText)
    expect(messages.lastIndexOf('Downloading features')).toBeLessThan(
      messages.indexOf('Computing layout'),
    )
  })

  it('is inert without a downstream callback', () => {
    const slot = createStatusFanOut(undefined)
    expect(() => {
      slot()('Downloading')
    }).not.toThrow()
  })
})

// The shape `assembly.loadPre` runs on: a fan-out slot per concurrent file,
// every slot behind ONE of the window's streams, and its `clear` at the end.
// The two halves are separable and each fails on its own, so both are pinned
// here — a hand-assembled fan-out with a bare clear beside it had both faults
// and neither was visible in the passing state.
describe('a fan-out behind one window stream', () => {
  let clock = 0
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // The owner's `finally` is what lands the final clear, not the slots retiring:
  // every write after the first falls inside the same window, so the slots' `''`
  // is queued behind the throttle like any other status. `loadPre` closes its
  // guard and then writes through `flush`, which both lands and drops the
  // queued write — a bare `setStatus(undefined)` beside a `throttle.run` fan-out
  // had neither half and neither fault was visible in the passing state.
  it('lands the final clear through the owner, not the retiring slots', () => {
    const statusWindow = createStatusWindow()
    const seen: (RpcStatus | undefined)[] = []
    let loading = true
    const stream = statusWindow.open({
      isCurrent: () => loading,
      write: s => {
        seen.push(s)
      },
    })
    const slot = createStatusFanOut(stream.statusCallback)
    const a = slot()
    const b = slot()
    a({ message: 'Downloading', current: 1, total: 2 })
    b({ message: 'Downloading', current: 1, total: 2 })
    a('')
    b('')
    // still inside the first write's window, so nothing since it has painted
    expect(seen).toEqual([{ message: 'Downloading', current: 1, total: 2 }])
    // the shape of `loadPre`'s finally
    loading = false
    stream.clear()
    expect(seen.at(-1)).toBeUndefined()
  })

  // `Promise.all` rejects on the first of the concurrent loads to fail while
  // the rest go on downloading and go on reporting. Unguarded, their progress
  // repaints the field the failure path has already cleared.
  it('drops a still-running sibling load once the owner has finished', () => {
    jest.useFakeTimers()
    try {
      const seen: (RpcStatus | undefined)[] = []
      let loading = true
      const statusWindow = createStatusWindow()
      const stream = statusWindow.open({
        isCurrent: () => loading,
        write: s => {
          seen.push(s)
        },
      })
      const slot = createStatusFanOut(stream.statusCallback)
      const failed = slot()
      const stillGoing = slot()
      failed({ message: 'Downloading', current: 1, total: 2 })
      expect(seen).toEqual([{ message: 'Downloading', current: 1, total: 2 }])

      // the `finally` of a load that threw: close the guard, then clear
      loading = false
      stream.clear()
      stillGoing({ message: 'Downloading', current: 2, total: 2 })
      clock += 100
      jest.advanceTimersByTime(100)
      expect(seen.at(-1)).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })

  // The other way the owner can go away, and the reason the assembly's guard
  // asks `isAlive(self)` as well as its own `loading` flag. A tree destroyed
  // WHILE its loads are in flight never reaches the `finally` that closes
  // `loading`, so that flag alone is still true when the trailing timer fires
  // and the write lands on a dead MST node. Neither flag implies the other, and
  // this covers the liveness half.
  it('drops a trailing write when the owner died before its finally ran', () => {
    jest.useFakeTimers()
    try {
      const seen: (RpcStatus | undefined)[] = []
      let alive = true
      const statusWindow = createStatusWindow()
      const slot = createStatusFanOut(
        statusWindow.open({
          isCurrent: () => alive,
          write: s => {
            seen.push(s)
          },
        }).statusCallback,
      )
      const load = slot()
      load({ message: 'Downloading', current: 1, total: 2 })
      expect(seen).toHaveLength(1)

      // queued behind the window, then the tree dies mid-load, with no
      // `finally` to close anything
      load({ message: 'Downloading', current: 2, total: 2 })
      alive = false
      clock += 100
      jest.advanceTimersByTime(100)
      expect(seen).toHaveLength(1)
    } finally {
      jest.useRealTimers()
    }
  })
})

// Randomized, because the shape that broke this module twice is one no
// hand-written case had: the cases above each pin one situation somebody thought
// of, and every defect ADR-080 lists came from regions interleaving in a way
// nobody wrote down. This drives N slots through the sequence the real helpers
// produce — a label, readings that only move forward, the enclosing label
// between reads, the next phase, then `''` — interleaved at random, and asserts
// only what must hold of EVERY stream the fan-out can emit.
//
// Seeded, so a failure is reproducible and a green run is not luck.
describe('createStatusFanOut: the shape of any stream it can emit', () => {
  const PHASES = ['Downloading features', 'Computing layout', 'Sizing region']

  function makeRandom(seed: number) {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff
      return state / 0x7fffffff
    }
  }

  function* oneSlotsWork(rnd: () => number): Generator<RpcStatus> {
    const phases = PHASES.filter(() => rnd() < 0.7)
    for (const message of phases.length > 0 ? phases : [PHASES[0]!]) {
      yield message
      for (let read = 1 + Math.floor(rnd() * 3); read > 0; read--) {
        const total = Math.floor(rnd() * 9000) + 1
        const ticks = 1 + Math.floor(rnd() * 4)
        for (let i = 1; i <= ticks; i++) {
          yield { message, current: Math.floor((total * i) / ticks), total }
        }
        // an inner phase closes onto the enclosing label, not onto `''`
        yield message
      }
    }
    yield ''
  }

  function runBatch(rnd: () => number) {
    const seen: RpcStatus[] = []
    const slot = createStatusFanOut(s => {
      seen.push(s)
    })
    const regions = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => ({
      report: slot(),
      work: oneSlotsWork(rnd),
      done: false,
    }))
    while (regions.some(r => !r.done)) {
      const live = regions.filter(r => !r.done)
      const region = live[Math.floor(rnd() * live.length)]!
      const next = region.work.next()
      if (next.done === true) {
        region.done = true
      } else {
        region.report(next.value)
      }
    }
    return seen
  }

  it('emits a well-formed status every time, and ends on the label', () => {
    for (let trial = 0; trial < 200; trial++) {
      const seen = runBatch(makeRandom(trial * 7919 + 1))
      for (const status of seen) {
        // `''` is the batch's owner to write, never ours
        expect(status).not.toBe('')
        if (typeof status === 'object') {
          // a bar that overshoots is the arithmetic having double-counted a
          // slot's finished work, which is the defect ADR-080 opens on
          expect(status.current).toBeGreaterThanOrEqual(0)
          expect(status.current).toBeLessThanOrEqual(status.total)
          expect(Number.isFinite(status.total)).toBe(true)
        }
      }
      // a percentage left standing for work that is over is the write ADR-071
      // exists to cancel: the last thing out is always the label alone
      expect(typeof seen.at(-1)).toBe('string')
    }
  })
})
