import { createProgress, formatDuration, progressLine } from './progress.ts'

describe('formatDuration', () => {
  it('reads as seconds, minutes or hours as the scale demands', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(130_000)).toBe('2m10s')
    expect(formatDuration(3_840_000)).toBe('1h04m')
  })

  it('is blank rather than NaN when there is nothing to estimate from', () => {
    expect(formatDuration(Number.NaN)).toBe('')
    expect(formatDuration(-1)).toBe('')
  })
})

describe('progressLine', () => {
  it('fills the bar in proportion and prints the counter', () => {
    const line = progressLine({
      done: 25,
      total: 100,
      failed: 0,
      elapsedMs: 25_000,
      width: 8,
    })
    expect(line).toContain('[##------]')
    expect(line).toContain(' 25%')
    expect(line).toContain('25/100')
  })

  it('pads the counter so the line does not jitter as it counts up', () => {
    const first = progressLine({ done: 1, total: 100, failed: 0, elapsedMs: 0 })
    const last = progressLine({
      done: 100,
      total: 100,
      failed: 0,
      elapsedMs: 0,
    })
    expect(first.indexOf('/100')).toBe(last.indexOf('/100'))
  })

  it('offers no ETA from a single sample', () => {
    // One network-bound render says nothing about the rest, and a confident
    // "eta 41m" on the first row is worse than no estimate at all.
    expect(
      progressLine({ done: 1, total: 100, failed: 0, elapsedMs: 5000 }),
    ).not.toContain('eta')
    expect(
      progressLine({ done: 2, total: 100, failed: 0, elapsedMs: 10_000 }),
    ).toContain('eta')
  })

  it('drops the ETA once the run is done rather than showing 0s', () => {
    expect(
      progressLine({ done: 100, total: 100, failed: 0, elapsedMs: 10_000 }),
    ).not.toContain('eta')
  })

  it('estimates from the mean rate over everything finished so far', () => {
    // 2 of 100 in 10s implies 5s each, so 98 left is 490s
    expect(
      progressLine({ done: 2, total: 100, failed: 0, elapsedMs: 10_000 }),
    ).toContain('eta 8m10s')
  })

  it('carries the failure count once there is one', () => {
    expect(
      progressLine({ done: 5, total: 10, failed: 0, elapsedMs: 0 }),
    ).not.toContain('failed')
    expect(
      progressLine({ done: 5, total: 10, failed: 2, elapsedMs: 0 }),
    ).toContain('2 failed')
  })
})

describe('createProgress', () => {
  function capture(isTty: boolean) {
    const out: string[] = []
    const progress = createProgress({
      total: 3,
      isTty,
      write: s => out.push(s),
      now: () => 0,
    })
    return { out, progress }
  }

  it('writes one line per record when stderr is NOT a terminal', () => {
    // A log is read after the fact, and a carriage-returned bar collapses to
    // gibberish in it. This is also what CI captures.
    const { out, progress } = capture(false)
    progress.step('a.png')
    progress.step('b.png')
    progress.finish('done')
    expect(out).toEqual(['[1/3] a.png\n', '[2/3] b.png\n', 'done\n'])
  })

  it('rewrites one line in place on a terminal', () => {
    const { out, progress } = capture(true)
    progress.step('a.png')
    progress.step('b.png')
    expect(out.every(s => s.startsWith('\r'))).toBe(true)
    expect(out.some(s => s.includes('a.png'))).toBe(false)
    expect(out.at(-1)).toContain('2/3')
  })

  it('prints a failure on its own line so a rewritten bar cannot eat it', () => {
    const { out, progress } = capture(true)
    progress.step('b.png', 'FAILED b.png: boom')
    const failLine = out.find(s => s.includes('FAILED'))
    expect(failLine).toBeDefined()
    expect(failLine!.endsWith('\n')).toBe(true)
    // and the bar is redrawn under it
    expect(out.at(-1)).toContain('1 failed')
  })

  it('does not log a failed record as if it rendered', () => {
    // The regression: a failure printed its own FAILED line and then an
    // ordinary `[n/total] name` line under it, which in a piped log — which is
    // what CI captures — is indistinguishable from a record that worked.
    const { out, progress } = capture(false)
    progress.step('a.png')
    progress.step('b.png', 'FAILED b.png: boom')
    expect(out).toEqual(['[1/3] a.png\n', '[2/3] FAILED b.png: boom\n'])
  })

  it('advances the queue on a failure, and counts it once', () => {
    const { out, progress } = capture(true)
    progress.step('a.png', 'FAILED a.png: boom')
    progress.step('b.png')
    // 2 of 3 attempted, 1 of them failed — the two counts used to come from two
    // separate calls and could disagree
    expect(out.at(-1)).toContain('2/3')
    expect(out.at(-1)).toContain('1 failed')
  })

  it('leaves the terminal on a fresh row when it finishes', () => {
    const { out, progress } = capture(true)
    progress.step('a.png')
    progress.finish('wrote 1/3')
    expect(out.at(-1)).toBe('\r\u001B[2Kwrote 1/3\n')
  })
})
