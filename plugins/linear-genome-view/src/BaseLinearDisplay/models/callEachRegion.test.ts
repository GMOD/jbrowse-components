import { callEachRegion } from './MultiRegionDisplayMixin.ts'

import type { FetchContext } from './FetchMixin.ts'

const NEEDED = [
  {
    region: { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 2,
  },
  {
    region: { refName: 'ctgB', start: 0, end: 100, assemblyName: 'volvox' },
    displayedRegionIndex: 5,
  },
]

function makeCtx(): FetchContext {
  return { stopToken: 'tok', isStale: () => false, statusCallback: () => {} }
}

test('pairs each result with its displayedRegionIndex, in needed order', async () => {
  const results = await callEachRegion(NEEDED, makeCtx(), region =>
    Promise.resolve(region.refName),
  )
  expect(results).toEqual([
    { displayedRegionIndex: 2, result: 'ctgA' },
    { displayedRegionIndex: 5, result: 'ctgB' },
  ])
})

// Order is by `needed`, not by completion — a caller committing positionally
// (MAF's cross-region sample pick walks the array) would otherwise mismatch.
test('preserves needed order when a later region resolves first', async () => {
  const results = await callEachRegion(NEEDED, makeCtx(), region =>
    region.refName === 'ctgA'
      ? new Promise<string>(resolve => {
          setTimeout(() => {
            resolve('slow')
          }, 10)
        })
      : Promise.resolve('fast'),
  )
  expect(results.map(r => r.result)).toEqual(['slow', 'fast'])
})

test('passes the region, ctx and index through to call', async () => {
  const ctx = makeCtx()
  const seen: { refName: string; sameCtx: boolean; index: number }[] = []
  await callEachRegion(NEEDED, ctx, (region, c, displayedRegionIndex) => {
    seen.push({
      refName: region.refName,
      // the caller's ctx reaches every call, so one stop token cancels the fan-out
      sameCtx: c === ctx,
      index: displayedRegionIndex,
    })
    return Promise.resolve(null)
  })
  expect(seen).toEqual([
    { refName: 'ctgA', sameCtx: true, index: 2 },
    { refName: 'ctgB', sameCtx: true, index: 5 },
  ])
})

// It deliberately owns no staleness policy — the caller picks per-region
// (fetchEachRegion) or per-batch (MAF) granularity.
test('runs regions concurrently and rejects if any call rejects', async () => {
  let started = 0
  await expect(
    callEachRegion(NEEDED, makeCtx(), region => {
      started++
      return region.refName === 'ctgB'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve('ok')
    }),
  ).rejects.toThrow('boom')
  expect(started).toBe(2)
})
