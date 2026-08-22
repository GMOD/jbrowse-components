import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { findContactAt } from '../LinearHicDisplay/contactLookup.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { TestContact } from './testContacts.ts'
import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 10
// region spans are res-aligned so a bin edge lands exactly on the region edge
const SPAN = 1000
const ROT_45 = Math.SQRT1_2

function region(refName: string, reversed: boolean): Region {
  return { refName, start: 0, end: SPAN, assemblyName: 'a', reversed }
}

async function run(regions: Region[], records: TestContact[]) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve(toContacts(records, RES)),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      // every region here is SPAN wide and they tile the axis contiguously
      axisBlocks: regions.map((r, i) => ({
        refName: r.refName,
        offsetBp: i * SPAN,
      })),
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
    },
  })
  // executeRenderHicData returns rpcResult(...) cast to the result type
  return (res as unknown as { value: HicDataResult }).value
}

// Center of contact i's drawn cell, rotated into screen-ish space. `rx` is the
// genomic-px axis, `ry` the contact-distance axis.
function cellCenter(d: HicDataResult, i: number) {
  const px = getInstancePosition(d.instances, i, 0)
  const py = getInstancePosition(d.instances, i, 1)
  const w = d.binWidth
  return {
    rx: (px + py + w) * ROT_45,
    ry: (-px + py) * ROT_45,
    ux: px + w / 2,
    uy: py + w / 2,
  }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

// positions[] is a Float32Array, so ~1e-5 px of storage error is expected.
// 3 decimals is thousands of times finer than the 7.07px bin width here, so
// this still fails loudly on a one-bin (or one-base) slip.
const PX = 3

// contacts inside region 0, inside region 1, and spanning the two
const RECORDS: TestContact[] = [
  { bin1: 0, bin2: 0, counts: 1, region1Idx: 0, region2Idx: 0 },
  { bin1: 0, bin2: 50, counts: 2, region1Idx: 0, region2Idx: 0 },
  { bin1: 90, bin2: 99, counts: 3, region1Idx: 0, region2Idx: 0 },
]
const MULTI: TestContact[] = [
  ...RECORDS,
  { bin1: 10, bin2: 20, counts: 4, region1Idx: 0, region2Idx: 1 },
  { bin1: 0, bin2: 30, counts: 5, region1Idx: 1, region2Idx: 1 },
  { bin1: 40, bin2: 40, counts: 6, region1Idx: 1, region2Idx: 1 },
]

describe('reversed hic regions', () => {
  test('a reversed block mirrors on the genomic axis and keeps its height', async () => {
    const fwd = await run([region('a', false)], RECORDS)
    const rev = await run([region('a', true)], RECORDS)

    // mirror invariant: a cell at rx lands at (blockWidthBp - rx) reversed,
    // at the same contact-distance height. No expected coordinates to
    // hand-compute, so it can't bake in whatever the code currently does.
    const blockWidthBp = SPAN
    expect(rev.numContacts).toBe(fwd.numContacts)
    for (let i = 0; i < fwd.numContacts; i++) {
      const f = cellCenter(fwd, i)
      const r = cellCenter(rev, i)
      expect(r.rx).toBeCloseTo(blockWidthBp - f.rx, PX)
      expect(r.ry).toBeCloseTo(f.ry, PX)
    }
    // and it actually moved — a no-op mirror would pass a symmetric fixture
    expect(round(cellCenter(rev, 1).rx)).not.toBe(round(cellCenter(fwd, 1).rx))
  })

  test.each([
    ['forward', [false, false]],
    ['both reversed', [true, true]],
    ['only region 1 reversed', [false, true]],
    ['only region 0 reversed', [true, false]],
  ])('%s: every cell stays above the axis', async (_name, rev) => {
    const d = await run([region('a', rev[0]!), region('b', rev[1]!)], MULTI)
    // ry < 0 renders below the axis — what a naive per-endpoint mirror does
    // when it breaks the u1 ≤ u2 ordering.
    for (let i = 0; i < d.numContacts; i++) {
      expect(cellCenter(d, i).ry).toBeGreaterThanOrEqual(0)
    }
  })

  test('reversing one region of two leaves the other region untouched', async () => {
    const fwd = await run([region('a', false), region('b', false)], MULTI)
    const rev = await run([region('a', false), region('b', true)], MULTI)

    // contact 0..2 live wholly in region 0 (not reversed) — identical
    for (let i = 0; i < 3; i++) {
      expect(cellCenter(rev, i).rx).toBeCloseTo(cellCenter(fwd, i).rx, PX)
    }
    // region 1 is reversed, so its intra-region contacts mirror within region
    // 1's own span and stay inside it
    const { dataXStart: s1, dataXEnd: e1 } = rev.regions[1]!
    for (const i of [4, 5]) {
      const { ux, uy } = cellCenter(rev, i)
      expect(ux).toBeGreaterThanOrEqual(s1)
      expect(uy).toBeLessThanOrEqual(e1)
      expect(round(cellCenter(rev, i).rx)).not.toBe(
        round(cellCenter(fwd, i).rx),
      )
    }
  })

  test.each([
    ['forward', [false, false]],
    ['both reversed', [true, true]],
    ['only region 1 reversed', [false, true]],
    ['only region 0 reversed', [true, false]],
  ])('%s: hover round-trips to the contact that was drawn', async (_n, rev) => {
    const d = await run([region('a', rev[0]!), region('b', rev[1]!)], MULTI)
    // Hovering the center of each drawn cell must report the contact that
    // produced it — this is what ties the baked mirror to the hit-test.
    for (let i = 0; i < d.numContacts; i++) {
      const { ux, uy } = cellCenter(d, i)
      expect(findContactAt(d, ux, uy)).toEqual({
        bin1: MULTI[i]!.bin1,
        bin2: MULTI[i]!.bin2,
        region1Idx: MULTI[i]!.region1Idx,
        region2Idx: MULTI[i]!.region2Idx,
        counts: MULTI[i]!.counts,
      })
    }
  })
})
