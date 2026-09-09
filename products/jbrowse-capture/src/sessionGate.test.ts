import { readSessionSummaryInPage, waitForSession } from './sessionGate.ts'

import type { Page } from 'puppeteer'

// evaluate/waitForFunction run the real in-page predicates against jsdom's own
// document, as readyChain.test.ts does.
const gatePage = () =>
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
  }) as unknown as Page

const census = (views: number, assemblies: string[], trackIds: string[]) => {
  document.body.innerHTML = `<span hidden data-app-phase="ready"
    data-app-views="${views}"
    data-app-assemblies='${JSON.stringify(assemblies)}'
    data-app-tracks='${JSON.stringify(trackIds)}'></span>`
}

afterEach(() => {
  document.body.replaceChildren()
})

test('no census on the page reports undefined', () => {
  expect(readSessionSummaryInPage()).toBeUndefined()
})

// One element answers the whole summary. Each view declares what it holds and
// the marker publishes the reduction (ADR-103), so nothing here knows that a
// synteny view keeps its tracks on levels and its rows on sub-views — the walk
// that did went with the builds that had no census.
test('the census answers the summary', () => {
  census(2, ['hg38', 'mm39'], ['genes', 'synteny'])
  expect(readSessionSummaryInPage()).toEqual({
    views: 2,
    assemblies: ['hg38', 'mm39'],
    trackIds: ['genes', 'synteny'],
  })
})

test('a malformed census reports undefined rather than throwing', () => {
  document.body.innerHTML =
    '<span data-app-tracks="not json" data-app-assemblies="[]"></span>'
  expect(readSessionSummaryInPage()).toBeUndefined()
})

test('a census with no view count reads as no views', () => {
  document.body.innerHTML =
    '<span data-app-tracks=\'["genes"]\' data-app-assemblies=\'["hg38"]\'></span>'
  expect(readSessionSummaryInPage()?.views).toBe(0)
})

test('the gate passes once the census holds what was asked for', async () => {
  census(1, ['hg38'], ['genes', 'clinvar'])
  await expect(
    waitForSession(gatePage(), {
      assembly: 'hg38',
      trackIds: ['genes'],
      timeout: 1000,
    }),
  ).resolves.toBeUndefined()
})

// The exact ids, not a count: a hosted config usually ships a defaultSession,
// so `&tracks=` ADDS to tracks already open and a count is satisfied before
// yours arrives — or by the default set alone when the id does not exist.
test('a trackId the config does not define fails the gate, and is named', async () => {
  census(1, ['hg38'], ['genes'])
  await expect(
    waitForSession(gatePage(), {
      assembly: 'hg38',
      trackIds: ['genes', 'typo'],
      timeout: 300,
    }),
  ).rejects.toThrow(/track\(s\) \[typo\].*found 1 view\(s\)/s)
})

test('an assembly that does not match fails the gate', async () => {
  census(1, ['hg19'], ['genes'])
  await expect(
    waitForSession(gatePage(), { assembly: 'hg38', timeout: 300 }),
  ).rejects.toThrow(/assembly "hg38".*assemblies \[hg19\]/s)
})

// The failure a config URL that 404s produces: nothing publishes a census at
// all, and the message has to say so rather than reporting an empty session.
test('no census at all is reported as such', async () => {
  await expect(
    waitForSession(gatePage(), { assembly: 'hg38', timeout: 300 }),
  ).rejects.toThrow('no census on the page at all')
})

test('a census with no views open does not satisfy the gate', async () => {
  census(0, [], [])
  await expect(waitForSession(gatePage(), { timeout: 300 })).rejects.toThrow(
    'Wanted an open view',
  )
})
