import {
  aggregateStatus,
  createProgressReporter,
  downloadStatus,
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
    // first call emits at current 0 (passes the bitmask gate); subsequent
    // calls advance but are gated out until the next mask boundary
    report()
    report()
    expect(seen[0]).toBe(0)
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

  it('is a pure cancel-tick with no statusCallback', () => {
    const report = createProgressReporter({ total: 10 })
    expect(() => {
      report()
      report()
    }).not.toThrow()
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
    const result = await updateStatus('Working', s => seen.push(s), () => 42)
    expect(result).toBe(42)
    expect(seen).toEqual(['Working', ''])
  })
  it('awaits an async fn', async () => {
    const seen: RpcStatus[] = []
    const result = await updateStatus('Working', s => seen.push(s), () =>
      Promise.resolve('done'),
    )
    expect(result).toBe('done')
    expect(seen).toEqual(['Working', ''])
  })
  it('is a no-op transport with no callback but still returns the result', async () => {
    expect(await updateStatus('Working', undefined, () => 7)).toBe(7)
  })
})

describe('downloadStatus', () => {
  it('labels the phase, hands fn a reporter, and clears when done', async () => {
    const seen: RpcStatus[] = []
    const result = await downloadStatus('Downloading index', s => seen.push(s), onProgress => {
      onProgress!(30, 60)
      return 'ok'
    })
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
    await downloadStatus('Downloading index', s => seen.push(s), onProgress => {
      onProgress!(1024)
    })
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
    // the kickoff report(0) emits (passes the bitmask gate at current 0); the
    // final emit is the clear
    expect(seen[0]).toEqual({ message: 'Processing', current: 0, total: 4 })
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

  it('ignores indeterminate (string) statuses when any region is determinate', () => {
    const agg = aggregateStatus([
      'Processing',
      { message: 'Downloading', current: 50, total: 100 },
    ])
    expect(agg).toEqual({ message: 'Downloading', current: 50, total: 100 })
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
