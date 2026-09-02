import { callEachRegion } from './fetchEachRegion.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { RpcStatus, StatusCallback } from '@jbrowse/core/util'

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
  return {
    stopToken: 'tok',
    isStale: () => false,
    statusCallback: () => {},
    callRpc() {
      throw new Error('callRpc is not stubbed in this test')
    },
  }
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
  const seen: { refName: string; sameToken: boolean; index: number }[] = []
  await callEachRegion(NEEDED, ctx, (region, c, displayedRegionIndex) => {
    seen.push({
      refName: region.refName,
      // the caller's stop token reaches every call, so one cancel takes the
      // whole fan-out down
      sameToken: c.stopToken === ctx.stopToken,
      index: displayedRegionIndex,
    })
    return Promise.resolve(null)
  })
  expect(seen).toEqual([
    { refName: 'ctgA', sameToken: true, index: 2 },
    { refName: 'ctgB', sameToken: true, index: 5 },
  ])
})

// The one field that is *not* the caller's: each region gets its own slot, so
// the N of them aggregate into a single bar rather than last-writer-wins on the
// display's one status field. A display writes `statusCallback:
// ctx.statusCallback` and gets that for free, which is the whole point — it used
// to have to remember `makeRegionStatusCallback(displayedRegionIndex)`, and
// forgetting looked exactly like remembering.
test("gives each region its own status slot, aggregated into the caller's", async () => {
  const seen: RpcStatus[] = []
  const ctx = { ...makeCtx(), statusCallback: (s: RpcStatus) => seen.push(s) }
  const report: StatusCallback[] = []
  await callEachRegion(NEEDED, ctx, (_region, c) => {
    report.push(c.statusCallback)
    return Promise.resolve(null)
  })
  const [a, b] = report
  expect(a).not.toBe(ctx.statusCallback)
  expect(a).not.toBe(b)
  a!({ message: 'Downloading', current: 30, total: 100 })
  b!({ message: 'Downloading', current: 10, total: 100 })
  // Σcurrent/Σtotal, not whichever reported last
  expect(seen.at(-1)).toEqual({
    message: 'Downloading',
    current: 40,
    total: 200,
  })
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
