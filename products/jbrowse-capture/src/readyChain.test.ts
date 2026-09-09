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

// The census and the phase, which is what every build the chain supports
// publishes. `phase` is what a test varies.
const app = (phase: string, body = '') => {
  document.body.innerHTML = `
    <span hidden data-app-phase="${phase}" data-app-views="1"
          data-app-assemblies='["hg38"]' data-app-tracks='["genes"]'></span>
    ${body}`
}

afterEach(() => {
  document.body.replaceChildren()
})

test('a ready app with nothing pending settles clean', async () => {
  app('ready')
  const report = await waitForJBrowseReady(fakePage(), {
    assembly: 'hg38',
    trackIds: ['genes'],
    timeout: 10000,
  })
  expect(report.unsettled).toEqual([])
  expect(report.pending).toEqual([])
}, 20000)

// The gate is the only check that the data asked for is the data on screen, and
// the only place a mistyped trackId fails at all — everything below it is
// satisfied by a browser that loaded and drew nothing.
test('a trackId that never opens fails the gate, not the paint wait', async () => {
  app('ready')
  await expect(
    waitForJBrowseReady(fakePage(), { trackIds: ['typo'], timeout: 300 }),
  ).rejects.toThrow('the session never reached the requested state')
})

// The fallback chain that used to run here was every remaining signal, and
// every one of them is an ABSENCE that an app which has not started also
// satisfies — so it reported success on an empty browser. Saying so is the
// answer; a wait that cannot fail is not.
test('a build with no marker is an error rather than a fallback chain', async () => {
  document.body.innerHTML = `<span hidden data-app-views="1"
    data-app-assemblies='["hg38"]' data-app-tracks='["genes"]'></span>`
  await expect(
    waitForJBrowseReady(fakePage(), { timeout: 300 }),
  ).rejects.toThrow('publishes no [data-app-phase]')
})

// The marker path when the app never reports ready: the stage lands in
// unsettled under its own name, the census lands beside it naming the display
// and its phase, and — with allowUnsettled — the caller gets the report rather
// than a throw.
test('an app that never goes ready reports the stage and the census', async () => {
  app(
    'loading',
    `<div data-testid="pileup" data-display-drawn="false"
          data-display-phase="loading"></div>`,
  )
  const report = await waitForJBrowseReady(fakePage(), {
    allowUnsettled: true,
    timeout: 200,
  })
  expect(report.unsettled).toEqual([
    'the app never held itself ready',
    'display(s) never painted: pileup is loading',
  ])
  expect(report.pending).toEqual(['pileup'])
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
  ['publishing no phase at all', ''],
])('a pending display %s keeps the paint wait going', async (_name, attr) => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="false" ${attr}></div>`
  await expect(waitForDisplaysDone(fakePage(), 100)).resolves.toBe(false)
})

// ...and the census the early return is traded for: the chain still fails, with
// the phase that says a longer timeout is not the fix. The marker reads `ready`
// over an error banner, which is a correct answer to a different question than
// a capture is asking.
test('an errored display is named unsettled instead of burning the timeout', async () => {
  app(
    'ready',
    `<div data-testid="pileup" data-display-drawn="false"
          data-display-phase="error"></div>`,
  )
  await expect(
    waitForJBrowseReady(fakePage(), { timeout: 30000 }),
  ).rejects.toThrow(/display\(s\) never painted: pileup is error/)
}, 15000)

// `--settle` is what the CLI's own "had not finished drawing" warning tells you
// to raise, and the census that decides whether the run fails used to be taken
// BEFORE it: a display that painted during the settle was absent from `pending`
// and still failed the run, so the report and the throw disagreed.
test('a display that paints during settleMs is not reported as never painted', async () => {
  app(
    'ready',
    `<div data-testid="pileup" data-display-drawn="false"
          data-display-phase="ready"></div>`,
  )
  // after waitForAppSettled's 1s hold, so the flip lands inside the settle
  setTimeout(() => {
    document.querySelector<HTMLElement>(
      '[data-testid="pileup"]',
    )!.dataset.displayDrawn = 'true'
  }, 2000)
  const report = await waitForJBrowseReady(fakePage(), {
    settleMs: 3000,
    timeout: 10000,
  })
  expect(report.pending).toEqual([])
  expect(report.unsettled).toEqual([])
}, 30000)
