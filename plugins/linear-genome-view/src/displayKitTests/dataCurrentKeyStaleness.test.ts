import { waitFor } from '@testing-library/react'

import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { PerRegionTestDisplay } from './perRegionTestEnv.ts'

// `dataCurrent` conjoins `isCacheValid`, and the two halves of that decision
// fail in opposite directions.
//
// Without the term, a zoom that moves `regionFetchKey` leaves every held region
// spatially covered and content-stale at once: `dataCurrent` stays true across
// the `FetchVisibleRegions` debounce plus the RPC, and an export sampling
// `svgReady` in that window paints data the previous key was fetched under —
// wiggle's bins, the variant matrix's columns, canvas's amino-acid wall.
//
// With the term folded one level lower — into `viewportWithinLoadedData` — the
// loading scrim would rise on every zoom instead, which is the trade
// REJECTED_IDEAS.md "Folding content staleness into `displayPhase`" turned
// down. So each test below pins one side, and a change that satisfies only one
// of them is the bug the other describes.

jest.setTimeout(30_000)

function setup() {
  const env = createPerRegionTestEnvironment()
  const created = env.createDisplay() as { display: PerRegionTestDisplay }
  return { ...env, ...created }
}

async function afterFirstFetch(display: PerRegionTestDisplay) {
  await waitFor(() => {
    expect(display.loadedRegions.size).toBeGreaterThan(0)
  })
}

test('a moved fetch key closes the export gate without moving the viewport one', async () => {
  const { display } = setup()
  await afterFirstFetch(display)

  expect(display.dataCurrent).toBe(true)
  expect(display.svgReady).toBe(true)

  display.setFetchKey('b')

  // The viewport has not moved, so the spatial predicate — the one the loading
  // scrim reads — is still true. Only the export gate closes.
  expect(display.viewportWithinLoadedData).toBe(true)
  expect(display.dataCurrent).toBe(false)
  expect(display.svgReady).toBe(false)
})

test('the refetch the moved key triggers reopens the gate', async () => {
  const { display } = setup()
  await afterFirstFetch(display)

  display.setFetchKey('b')
  expect(display.dataCurrent).toBe(false)

  // `planRegionFetch` refetches a covered block on `!isCacheValid` and reads
  // that term tracked, so the key move that closed the gate is what wakes the
  // fetch that reopens it. A term that could not be reached this way would hang
  // every later export on `awaitSvgReady`'s backstop.
  await waitFor(
    () => {
      expect(display.dataCurrent).toBe(true)
    },
    { timeout: 10_000 },
  )
  expect(display.loadedRegions.get(0)?.fetchKey).toBe('b')
})
