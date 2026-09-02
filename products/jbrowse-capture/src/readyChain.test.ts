import { waitForJBrowseReady } from './ready.ts'

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
// unsettled under its own name, the census still says which display had not
// painted, and — with allowUnsettled — the caller gets the report rather than
// a throw.
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
  expect(report.unsettled).toEqual(['the app never reported itself ready'])
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
