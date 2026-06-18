import {
  aggregateStatus,
  createProgressReporter,
  statusFraction,
  statusMessageText,
} from './progress.ts'

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
