import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { DEFAULT_PLINK_LD_HEADER, LD_NOT_COMPUTED } from '@jbrowse/ld-core'

import { executeRenderLDData } from './executeRenderLDData.ts'
import { MAX_LD_CELLS } from './getLDMatrixFromPlink.ts'
import { bandCellCount, bandPairIndex } from './ldBand.ts'

import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'
import type { PlinkLDRecord } from '@jbrowse/ld-core'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const SPAN = 1000

function region(refName: string, reversed: boolean, offset = 0): Region {
  return {
    refName,
    start: offset,
    end: offset + SPAN,
    assemblyName: 'a',
    reversed,
  }
}

interface Locus {
  refName: string
  bp: number
}

const at = (refName: string, bp: number): Locus => ({ refName, bp })

// distinct per pair and symmetric, so a mis-indexed cell cannot match
function pairValue(a: Locus, b: Locus) {
  return (Math.min(a.bp, b.bp) * 10_000 + Math.max(a.bp, b.bp)) / 1e9
}

function record(a: Locus, b: Locus): PlinkLDRecord {
  return {
    chrA: a.refName,
    bpA: a.bp,
    snpA: `${a.refName}:${a.bp}`,
    chrB: b.refName,
    bpB: b.bp,
    snpB: `${b.refName}:${b.bp}`,
    r2: pairValue(a, b),
  }
}

function allPairs(loci: Locus[]) {
  return loci.flatMap((a, i) => loci.slice(i + 1).map(b => record(a, b)))
}

// A source answering by A side, as both PLINK adapters do.
function serve(records: PlinkLDRecord[]) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getHeader: () => Promise.resolve(DEFAULT_PLINK_LD_HEADER),
      getLDRecords: (q: { refName: string; start: number; end: number }) =>
        Promise.resolve(
          records.filter(
            r => r.chrA === q.refName && r.bpA > q.start && r.bpA <= q.end,
          ),
        ),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
}

async function run(
  regions: Region[],
  records: PlinkLDRecord[],
  useGenomicPositions = false,
) {
  serve(records)
  return unwrapRpcResult(
    await executeRenderLDData({
      pluginManager: {} as PluginManager,
      args: {
        sessionId: 'test',
        adapterConfig: { type: 'PlinkLDAdapter' },
        regions,
        originBp: 0,
        spanBp: regions.reduce((sum, r) => sum + r.end - r.start, 0),
        field: 'r2',
        layout: useGenomicPositions ? 'genomic' : 'columns',
      },
    }),
  )
}

const bps = (d: LDDataResult) => d.snps.map(s => s.end)

function valueFor(d: LDDataResult, a: number, b: number) {
  const i = d.snps.findIndex(s => s.end === a)
  const j = d.snps.findIndex(s => s.end === b)
  const slot = bandPairIndex(i, j, d.band)
  return slot < 0 ? LD_NOT_COMPUTED : d.ldValues[slot]!
}

const POSITIONS = [100, 250, 400, 900]
const FULL = allPairs(POSITIONS.map(bp => at('a', bp)))

describe('a reversed region', () => {
  test.each([true, false])(
    'reverses the index axis (genomic positions %s)',
    async genomic => {
      const rev = await run([region('a', true)], FULL, genomic)
      expect(bps(rev)).toEqual([...POSITIONS].reverse())
    },
  )

  test('keeps every pair its value', async () => {
    const fwd = await run([region('a', false)], FULL)
    const rev = await run([region('a', true)], FULL)
    for (const a of POSITIONS) {
      for (const b of POSITIONS.filter(p => p !== a)) {
        expect(valueFor(rev, a, b)).toBe(valueFor(fwd, a, b))
      }
    }
  })

  test('mirrors genomic columns: same widths, reversed order', async () => {
    const fwd = await run([region('a', false)], FULL, true)
    const rev = await run([region('a', true)], FULL, true)
    const widths = (d: LDDataResult) =>
      [...d.snps.keys()].map(i => d.boundaries[i + 1]! - d.boundaries[i]!)
    const f = widths(fwd).reverse()
    for (const [i, width] of widths(rev).entries()) {
      expect(width).toBeCloseTo(f[i]!, 3)
    }
    for (let i = 1; i < rev.boundaries.length; i++) {
      expect(rev.boundaries[i]!).toBeGreaterThan(rev.boundaries[i - 1]!)
    }
  })

  test('leaves uniform columns even', async () => {
    const fwd = await run([region('a', false)], FULL)
    const rev = await run([region('a', true)], FULL)
    expect([...rev.boundaries]).toEqual([...fwd.boundaries])
  })

  test('leaves a forward neighbour alone', async () => {
    const loci = [
      ...POSITIONS.map(bp => at('a', bp)),
      ...POSITIONS.map(bp => at('b', bp + 2000)),
    ]
    const regions = [region('a', false), region('b', true, 2000)]
    const out = await run(regions, allPairs(loci))
    expect(bps(out)).toEqual([...POSITIONS, 2900, 2400, 2250, 2100])
  })
})

// Collapsing the introns of a minus-strand gene lists the regions descending
// and marks each reversed, so the view draws bp descending throughout.
test('screen order comes from the regions array', async () => {
  const loci = [100, 250, 2100, 2250].map(bp => at('a', bp))
  const out = await run(
    [region('a', true, 2000), region('a', true, 0)],
    allPairs(loci),
  )
  expect(bps(out)).toEqual([2250, 2100, 250, 100])
})

describe('the band', () => {
  test('is the widest pair the file lists', async () => {
    const loci = [100, 200, 300, 400, 500].map(bp => at('a', bp))
    const adjacent = loci.slice(1).map((b, i) => record(loci[i]!, b))
    const out = await run([region('a', false)], adjacent)
    expect(out.band).toBe(1)
    expect(out.numCells).toBe(4)
    expect(valueFor(out, 100, 200)).toBeCloseTo(pairValue(loci[0]!, loci[1]!))
  })

  // Blocks listed in the reverse of their genomic order put the two blocks'
  // far ends side by side on screen. Banding in sorted order dropped those
  // pairs although the file lists them.
  test('holds a pair the file lists across a seam the view reorders', async () => {
    const loci = [
      ...[100, 200, 300].map(bp => at('chr1', bp)),
      ...[5100, 5200, 5300].map(bp => at('chr1', bp)),
    ]
    const adjacentOnScreen = [
      record(loci[3]!, loci[4]!),
      record(loci[4]!, loci[5]!),
      record(loci[5]!, loci[0]!),
      record(loci[0]!, loci[1]!),
      record(loci[1]!, loci[2]!),
    ]
    const out = await run(
      [region('chr1', false, 5000), region('chr1', false, 0)],
      adjacentOnScreen,
    )
    expect(bps(out)).toEqual([5100, 5200, 5300, 100, 200, 300])
    expect(out.band).toBe(1)
    expect([...out.ldValues].every(v => v !== LD_NOT_COMPUTED)).toBe(true)
  })

  test('skips a listed pair with no value of the metric', async () => {
    const loci = [100, 200, 300].map(bp => at('a', bp))
    const out = await run(
      [region('a', false)],
      [
        record(loci[0]!, loci[1]!),
        { ...record(loci[0]!, loci[2]!), r2: undefined },
      ],
    )
    expect(out.band).toBe(1)
  })
})

// One variant paired with every other, as a LocusZoom file pairs its index
// SNP, widens the band to the whole triangle.
test('a view past the cell cap refuses rather than allocates', async () => {
  const n = 4500
  expect(bandCellCount(n, n - 1)).toBeGreaterThan(MAX_LD_CELLS)
  const index = at('a', 1)
  const loci = Array.from({ length: n - 1 }, (_, i) => at('a', i + 2))
  await expect(
    run(
      [{ ...region('a', false), end: n + 1 }],
      loci.map(l => record(index, l)),
    ),
  ).rejects.toThrow(/zoom in/)
})

test('the end columns do not move with the fetched block', async () => {
  const loci = [400, 600].map(bp => at('a', bp))
  const widths = async (start: number) => {
    const out = await run(
      [{ ...region('a', false), start, end: 1000 }],
      allPairs(loci),
      true,
    )
    const b = out.boundaries
    return [b[1]! - b[0]!, b[2]! - b[1]!]
  }
  const [first, last] = await widths(0)
  expect(first).toBeCloseTo(last!, 5)
  const [first2, last2] = await widths(300)
  expect(first2).toBeCloseTo(first!, 3)
  expect(last2).toBeCloseTo(last!, 3)
})
