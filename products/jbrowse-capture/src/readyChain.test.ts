import { waitForJBrowseReady } from './ready.ts'
import { waitForDisplaysDone } from './waits.ts'

import type { Page } from 'puppeteer'

// A page whose evaluate/wait primitives run against jsdom's own document, so
// the chain under test executes the real in-page predicates rather than copies
// of them — the same approach as appSettled.test.ts, extended to the two wait
// shapes waitForJBrowseReady uses.
const fakePage = () =>
  ({
    evaluate: (fn: (...a: unknown[]) => unknown, ...args: unknown[]) =>
      Promise.resolve(fn(...args)),
    waitForFunction: async (
      fn: (...a: unknown[]) => unknown,
      opts: { timeout?: number } = {},
      ...args: unknown[]
    ) => {
      const deadline = Date.now() + (opts.timeout ?? 30000)
      for (;;) {
        if (fn(...args)) {
          return {}
        }
        if (Date.now() >= deadline) {
          throw new Error(`Waiting failed: ${opts.timeout}ms exceeded`)
        }
        await new Promise(r => setTimeout(r, 10))
      }
    },
    waitForSelector: async (
      selector: string,
      opts: { timeout?: number } = {},
    ) => {
      const deadline = Date.now() + (opts.timeout ?? 30000)
      for (;;) {
        const el = document.querySelector(selector)
        if (el) {
          return el
        }
        if (Date.now() >= deadline) {
          throw new Error(`Waiting failed: ${opts.timeout}ms exceeded`)
        }
        await new Promise(r => setTimeout(r, 10))
      }
    },
  }) as unknown as Page

afterEach(() => {
  document.body.replaceChildren()
  delete (globalThis as { JBrowseSession?: unknown }).JBrowseSession
})

// The census path: on a build whose marker publishes what is open, the whole
// session gate is a read of one element — no walk of window.JBrowseSession,
// which is not even present here.
test('the marker census satisfies the session gate without a session walk', async () => {
  document.body.innerHTML = `
    <span hidden data-app-phase="ready" data-app-views="1"
          data-app-assemblies='["hg38"]' data-app-tracks='["genes"]'></span>`
  const report = await waitForJBrowseReady(fakePage(), {
    assembly: 'hg38',
    trackIds: ['genes'],
    // above the hold the marker path requires: `ready` has to still be ready a
    // beat later, or the wait takes the frame between two debounced fetches
    timeout: 2000,
  })
  expect(report.appMarker).toBe(true)
  expect(report.unsettled).toEqual([])
}, 15000)

test('a census missing the requested track fails the gate with the diagnostic', async () => {
  document.body.innerHTML = `
    <span hidden data-app-phase="ready" data-app-views="1"
          data-app-assemblies='["hg38"]' data-app-tracks='["genes"]'></span>`
  await expect(
    waitForJBrowseReady(fakePage(), {
      assembly: 'hg38',
      trackIds: ['clinvar'],
      timeout: 200,
    }),
  ).rejects.toThrow(/track\(s\) \[clinvar\].*tracks \[genes\]/s)
}, 15000)

// The regression this file exists for. With the session gate skipped, the
// marker and instrumentation reads race the boot: an empty page has no marker,
// no attributes and no session, and every stage in the fallback chain is an
// absence an empty page satisfies. Reading "no session summary" as "no tracks
// open" then skipped the quiet gate too, so the whole wait passed in
// milliseconds over an app that had not started — the blank capture the
// package exists to prevent, on the one path with no positive gate.
test('expectSession: false on an empty page still runs the quiet gate', async () => {
  const report = await waitForJBrowseReady(fakePage(), {
    expectSession: false,
    allowUnsettled: true,
    timeout: 200,
  })
  expect(report.appMarker).toBe(false)
  expect(report.unsettled.some(s => s.includes('never went quiet'))).toBe(true)
}, 15000)

// A session that reports no tracks open has nothing to load, and the gate
// skipping there is what keeps an import form or a menu shot from paying the
// busy window as a fixed sleep. Only a KNOWN-empty session earns that.
test('a session known to have no tracks open skips the quiet gate', async () => {
  ;(globalThis as { JBrowseSession?: unknown }).JBrowseSession = {
    views: [{ tracks: [] }],
  }
  const report = await waitForJBrowseReady(fakePage(), {
    expectSession: false,
    allowUnsettled: true,
    timeout: 200,
  })
  expect(report.unsettled).toEqual([])
}, 15000)

// The marker path when the app never reports ready: the stage lands in
// unsettled under its own name, the census lands beside it naming the display
// and its phase, and — with allowUnsettled — the caller gets the report rather
// than a throw.
test('a marker build that never goes ready reports the stage and the census', async () => {
  document.body.innerHTML = `
    <span hidden data-app-phase="loading"></span>
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="loading"></div>`
  const report = await waitForJBrowseReady(fakePage(), {
    expectSession: false,
    allowUnsettled: true,
    timeout: 200,
  })
  expect(report.appMarker).toBe(true)
  expect(report.unsettled).toEqual([
    'the app never held itself ready',
    'display(s) never painted: pileup is loading',
  ])
  expect(report.pending).toEqual(['pileup'])
}, 15000)

// waitForDownloads: false asks for none of the busy-report waiting, and the
// download half and the label half are one predicate now, so neither runs.
test('waitForDownloads: false leaves a lingering status message unsettled-free', async () => {
  ;(globalThis as { JBrowseSession?: unknown }).JBrowseSession = {
    views: [{ tracks: [{ displays: [{ message: 'Downloading features' }] }] }],
  }
  document.body.innerHTML = '<div data-display-phase="ready"></div>'
  const report = await waitForJBrowseReady(fakePage(), {
    expectSession: false,
    waitForDownloads: false,
    allowUnsettled: true,
    timeout: 200,
  })
  expect(report.unsettled).toEqual([])
}, 15000)

// A display in a terminal phase is not coming back, and the two comparative
// canvases hold `drawn=false` open through `error` on purpose. Waiting on the
// attribute alone spent the whole timeout on an answer the census already had.
test('a pending display that has errored ends the paint wait at once', async () => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="error"></div>`
  const start = Date.now()
  await expect(waitForDisplaysDone(fakePage(), 2000)).resolves.toBe(true)
  expect(Date.now() - start).toBeLessThan(500)
})

test.each([
  ['still loading', 'data-display-phase="loading"'],
  ['publishing no phase at all, on a build older than the attribute', ''],
])('a pending display %s keeps the paint wait going', async (_name, attr) => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="false" ${attr}></div>`
  await expect(waitForDisplaysDone(fakePage(), 100)).resolves.toBe(false)
})

// ...and the census the early return is traded for: the chain still fails, with
// the phase that says a longer timeout is not the fix.
test('an errored display is named unsettled instead of burning the timeout', async () => {
  document.body.innerHTML = `
    <span hidden data-app-phase="ready"></span>
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="error"></div>`
  await expect(
    waitForJBrowseReady(fakePage(), { expectSession: false, timeout: 30000 }),
  ).rejects.toThrow(/display\(s\) never painted: pileup is error/)
}, 15000)

// `--settle` is what the CLI's own "had not finished drawing" warning tells you
// to raise, and the census that decides whether the run fails used to be taken
// BEFORE it: a display that painted during the settle was absent from `pending`
// and still failed the run, so the report and the throw disagreed.
test('a display that paints during settleMs is not reported as never painted', async () => {
  document.body.innerHTML = `
    <span hidden data-app-phase="ready"></span>
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="ready"></div>`
  // after waitForAppSettled's 1s hold, so the flip lands inside the settle
  setTimeout(() => {
    document
      .querySelector('[data-testid="pileup"]')!
      .setAttribute('data-display-drawn', 'true')
  }, 2000)
  const report = await waitForJBrowseReady(fakePage(), {
    expectSession: false,
    settleMs: 3000,
    timeout: 10000,
  })
  expect(report.pending).toEqual([])
  expect(report.unsettled).toEqual([])
}, 30000)
