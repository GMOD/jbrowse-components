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
  expect(report.pending).toEqual([{ name: 'pileup', phase: 'loading' }])
}, 15000)

// A display in a terminal phase is not coming back, and the two comparative
// canvases hold `drawn=false` open through `error` on purpose. Waiting on the
// attribute alone spent the whole timeout on an answer the census already had.
test('a pending display that has errored ends the paint wait at once', async () => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="error"></div>`
  const start = Date.now()
  await expect(
    waitForDisplaysDone(fakePage(), { timeout: 2000 }),
  ).resolves.toBe(true)
  expect(Date.now() - start).toBeLessThan(500)
})

test.each([
  ['still loading', 'data-display-phase="loading"'],
  ['publishing no phase at all', ''],
])('a pending display %s keeps the paint wait going', async (_name, attr) => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="false" ${attr}></div>`
  await expect(waitForDisplaysDone(fakePage(), { timeout: 100 })).resolves.toBe(
    false,
  )
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
  ).rejects.toThrow(/^display\(s\) never painted: pileup is error\. No timeout/)
}, 15000)

// The marker reads `ready` over a cancel, which is finished work; the capture
// still refuses to commit a picture of the Retry overlay.
test('a canceled display fails the chain at once rather than timing out', async () => {
  app(
    'ready',
    `<div data-testid="pileup" data-display-drawn="true"
          data-display-phase="canceled"></div>`,
  )
  const start = Date.now()
  await expect(
    waitForJBrowseReady(fakePage(), { timeout: 30000 }),
  ).rejects.toThrow(
    /^display\(s\) canceled, which lasts until Retry: pileup is canceled\. No timeout/,
  )
  expect(Date.now() - start).toBeLessThan(10000)
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

// "Too much data" is the app declining a wide region as designed, so the
// capture goes ahead, and says which displays show the banner.
test('a too-large display passes the chain and is reported', async () => {
  app(
    'ready',
    `<div style="display: contents" data-display-id="hg38-clinvar"
          data-display-phase="tooLarge"></div>`,
  )
  const report = await waitForJBrowseReady(fakePage(), { timeout: 10000 })
  expect(report.unsettled).toEqual([])
  expect(report.tooLarge).toEqual([
    { name: 'hg38-clinvar', id: 'hg38-clinvar', phase: 'tooLarge' },
  ])
}, 20000)

// A render error replaces the display with a Retry banner and publishes no
// paint flag, so it used to pass as a display that was not there at all.
test('a display whose renderer failed fails the chain', async () => {
  app(
    'ready',
    `<div style="display: contents" data-display-id="hg38-genes"
          data-display-phase="renderError"></div>`,
  )
  await expect(
    waitForJBrowseReady(fakePage(), { timeout: 10000 }),
  ).rejects.toThrow(
    /^display\(s\) never painted: hg38-genes is renderError\. No timeout/,
  )
}, 20000)

test('a stage that timed out says so, and names the timeout as the fix', async () => {
  app(
    'loading',
    `<div data-testid="pileup" data-display-drawn="false"
          data-display-phase="loading"></div>`,
  )
  await expect(
    waitForJBrowseReady(fakePage(), { timeout: 200 }),
  ).rejects.toThrow(/^gave up waiting after 200ms: .*Raise the timeout/)
}, 15000)

// `views` is a session expectation like the other two, so the whole chain has
// to hand it to the gate rather than a copied subset of the options
test('a views floor of 0 reaches the gate through the whole chain', async () => {
  document.body.innerHTML = `<span hidden data-app-phase="ready"
    data-app-views="0" data-app-assemblies='[]' data-app-tracks='[]'></span>`
  const report = await waitForJBrowseReady(fakePage(), {
    views: 0,
    timeout: 10000,
  })
  expect(report.unsettled).toEqual([])
}, 20000)
