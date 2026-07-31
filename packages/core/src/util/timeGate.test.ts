import { createTimeGate } from './timeGate.ts'

// Drive the gate over `calls` iterations, advancing the mocked clock by
// `msPerCall` each time. Returns how often it fired and how often it actually
// read the clock — the two properties the gate trades off.
function run({
  calls,
  msPerCall,
  intervalMs,
}: {
  calls: number
  msPerCall: number
  intervalMs: number
}) {
  let now = 1_000_000
  let clockReads = 0
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => {
    clockReads++
    return now
  })
  try {
    const due = createTimeGate()
    let fires = 0
    for (let i = 0; i < calls; i++) {
      if (due(intervalMs)) {
        fires++
      }
      now += msPerCall
    }
    return { fires, clockReads }
  } finally {
    spy.mockRestore()
  }
}

// The whole point: a hot loop must not pay Date.now() per call.
test('a hot loop reads the clock a handful of times per interval', () => {
  // 666k calls over ~2000ms — the ultra-deep pileup shape that measured ~28ms
  // of Date.now() per gated callsite.
  const { fires, clockReads } = run({
    calls: 666_000,
    msPerCall: 2000 / 666_000,
    intervalMs: 100,
  })
  expect(fires).toBeGreaterThan(15) // ~20 emits over 2000ms at 100ms
  expect(fires).toBeLessThan(30)
  expect(clockReads).toBeLessThan(400) // vs 666_000 before
})

// The regression a fixed stride caused. A few hundred items with heavy per-item
// work must fire on every call, exactly as an ungated clock read would.
test('a low-count heavy loop keeps a stride of 1 and never goes blind', () => {
  const { fires, clockReads } = run({
    calls: 300,
    msPerCall: 200,
    intervalMs: 100,
  })
  expect(fires).toBe(300)
  expect(clockReads).toBe(300)
})

test('fires at most once per interval', () => {
  const { fires } = run({ calls: 1000, msPerCall: 0, intervalMs: 100 })
  expect(fires).toBe(1) // the initial fire only; the clock never advances
})

test('the first call always fires, so an initial 0% tick is never swallowed', () => {
  const due = createTimeGate()
  expect(due(100)).toBe(true)
})

// intervalMs 0 is "emit on every call" (used by tests and by callers that do
// their own throttling); the learned stride must not thin it.
test('a zero interval fires on every call', () => {
  const { fires } = run({ calls: 50, msPerCall: 1, intervalMs: 0 })
  expect(fires).toBe(50)
})

// The stride is an extrapolation, so a mid-loop collapse in call rate leaves
// the gate blind for at most MAX_STRIDE calls. Assert it recovers rather than
// wedging: after the rate drops, firing resumes.
test('recovers when the call rate collapses mid-loop', () => {
  let now = 1_000_000
  const spy = jest.spyOn(Date, 'now').mockImplementation(() => now)
  try {
    const due = createTimeGate()
    for (let i = 0; i < 100_000; i++) {
      due(100)
      now += 0.01 // 100 calls/ms: the gate learns a large stride
    }
    let fires = 0
    for (let i = 0; i < 100_000; i++) {
      if (due(100)) {
        fires++
      }
      now += 10 // per-item cost jumps 1000x
    }
    expect(fires).toBeGreaterThan(0)
  } finally {
    spy.mockRestore()
  }
})
