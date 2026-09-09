import { waitForAppSettled, waitForQuietPeriod } from './waits.ts'

import type { Page } from 'puppeteer'

// The page functions are run against jsdom's own document, so these exercise the
// real predicates rather than a copy of them: the test moves `data-app-phase` and
// the wait reads it the way it reads a real page.
const jsdomPage = () =>
  ({
    evaluate: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) =>
      Promise.resolve(fn(...args)),
  }) as unknown as Page

const setPhase = (phase: string) => {
  document.body.innerHTML = `<span hidden data-app-phase="${phase}"></span>`
}

afterEach(() => {
  document.body.replaceChildren()
})

// Short holds and a tight poll so these run in milliseconds; the property under
// test is the shape of the wait, not the constant.
const FAST = { holdMs: 60, pollMs: 10 }

test('a ready app is not settled until ready has held', async () => {
  setPhase('ready')
  const start = Date.now()
  await expect(waitForAppSettled(jsdomPage(), FAST)).resolves.toBe(true)
  expect(Date.now() - start).toBeGreaterThanOrEqual(FAST.holdMs)
})

// The whole reason this is a hold rather than a read of the selector. An
// interaction leaves the app reading `ready` — it finished a moment ago — and the
// work it started only shows up once a debounced autorun fires, so a wait that
// returns on the first `ready` returns on the pre-interaction frame.
test('work that starts after the wait does resets the hold', async () => {
  setPhase('ready')
  const startedWorkingAt = setTimeout(() => {
    setPhase('loading')
  }, 30)
  const finishedAt = setTimeout(() => {
    setPhase('ready')
  }, 120)
  const start = Date.now()
  await expect(waitForAppSettled(jsdomPage(), FAST)).resolves.toBe(true)
  // it cannot have returned before the work finished, let alone before it began
  expect(Date.now() - start).toBeGreaterThanOrEqual(120 + FAST.holdMs)
  clearTimeout(startedWorkingAt)
  clearTimeout(finishedAt)
})

test('an app still working when the timeout expires reports false', async () => {
  setPhase('loading')
  await expect(
    waitForAppSettled(jsdomPage(), { ...FAST, timeout: 50 }),
  ).resolves.toBe(false)
})

// A build too old for the marker must not pass, and must not quietly wait out
// an absence either: every other readiness attribute is satisfied by an app
// that has not started, so a fallback here reports success on an empty browser.
test('a build with no marker is an error, not a fallback', async () => {
  document.body.innerHTML = '<div data-testid="loading-overlay"></div>'
  await expect(waitForAppSettled(jsdomPage(), FAST)).rejects.toThrow(
    'publishes no [data-app-phase]',
  )
})

// Idle has to HOLD: a track that ends one fetch and starts the next is
// momentarily idle, and a single-sample read takes that gap for the end.
test('the quiet period restarts when the page goes busy again', async () => {
  const goBusy = setTimeout(() => {
    document.body.innerHTML = '<div data-testid="loading-overlay"></div>'
  }, 100)
  const goIdle = setTimeout(() => {
    document.body.replaceChildren()
  }, 200)
  const start = Date.now()
  await expect(
    waitForQuietPeriod(jsdomPage(), {
      quietMs: 300,
      pollMs: 10,
      timeout: 3000,
    }),
  ).resolves.toBe(true)
  expect(Date.now() - start).toBeGreaterThanOrEqual(500)
  clearTimeout(goBusy)
  clearTimeout(goIdle)
})
