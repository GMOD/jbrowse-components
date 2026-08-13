import HicFile from './index.ts'
import { openLocalTestHic } from './testFile.ts'

import type { HicRegion } from './types.ts'

// A `.hic` stores only the `bin1 <= bin2` half, so `getContactRecords` swaps a
// query whose x window sits right of its y window and reports `transposed` so
// the adapter can un-swap. A multi-region view is what makes the swap reachable
// in every direction: it queries every displayed pair `(i, j)` in SCREEN order,
// which need not be genomic order, and the displayed regions may overlap.
//
// These read the real file, because the bug this pins was one the arithmetic
// hides: the wrong window still returns contacts, just far too few, and the
// display draws that as a sparse off-diagonal block rather than as an error.

const RES = 2_500_000
const chr1 = (start: number, end: number): HicRegion => ({
  chr: '1',
  start,
  end,
})

// Two overlapping windows on chr1: 50-150Mb and 100-200Mb.
const LEFT = chr1(50_000_000, 150_000_000)
const RIGHT = chr1(100_000_000, 200_000_000)
// Disjoint, for the case the original `start >= end` test already handled.
const FAR_LEFT = chr1(0, 50_000_000)

function open() {
  return new HicFile({ file: openLocalTestHic() })
}

async function records(region1: HicRegion, region2: HicRegion) {
  const { records: recs, transposed } = await open().getContactRecords(
    'NONE',
    region1,
    region2,
    'BP',
    RES,
  )
  return {
    n: recs.bin1.length,
    bin1: [...recs.bin1],
    bin2: [...recs.bin2],
    transposed,
  }
}

test('an overlapping same-chr pair is transposed when displayed right-to-left', async () => {
  const genomic = await records(LEFT, RIGHT)
  const displayed = await records(RIGHT, LEFT)

  // The pair holds real off-diagonal signal, so a dropped window is visible in
  // the count rather than being an empty-vs-empty comparison.
  expect(genomic.n).toBe(901)
  expect(genomic.transposed).toBe(false)

  // Same query after the swap, so the records are identical and only the flag
  // the adapter un-swaps by differs. Comparing `region1.start` against
  // `region2.END` — hic-straw's test — leaves this un-transposed and asks for
  // the half of the matrix the file does not store, which returned the 78
  // contacts of the overlap sliver and silently dropped the other 823.
  expect(displayed.transposed).toBe(true)
  expect(displayed.n).toBe(genomic.n)
  expect(displayed.bin1).toEqual(genomic.bin1)
  expect(displayed.bin2).toEqual(genomic.bin2)
})

test('a disjoint same-chr pair displayed right-to-left is still transposed', async () => {
  const genomic = await records(FAR_LEFT, RIGHT)
  const displayed = await records(RIGHT, FAR_LEFT)

  expect(genomic.n).toBeGreaterThan(0)
  expect(genomic.transposed).toBe(false)
  expect(displayed.transposed).toBe(true)
  expect(displayed.n).toBe(genomic.n)
  expect(displayed.bin1).toEqual(genomic.bin1)
})

test('forward order and an identical pair are left alone', async () => {
  expect((await records(LEFT, RIGHT)).transposed).toBe(false)
  // Equal starts must not transpose — it would be a no-op, but only because the
  // two regions are the same query; a `>=` here would make the flag lie about
  // which axis `bin1` runs along for a pair sharing a start but not an end.
  expect((await records(LEFT, chr1(50_000_000, 80_000_000))).transposed).toBe(
    false,
  )
})
