import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { calcAxisBlocks } from '../regionOffsets.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { TestContact } from './testContacts.ts'
import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 100
const ROT_45 = Math.SQRT1_2

async function run(
  regions: Region[],
  regionOffsetsBp: number[],
  records: TestContact[],
) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve(toContacts(records, RES)),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const out = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      axisBlocks: regions.map((r, i) => ({
        refName: r.refName,
        offsetBp: regionOffsetsBp[i]!,
      })),
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
    },
  })
  return (out as unknown as { value: HicDataResult }).value
}

// Axis-bp position of a diagonal cell's apex-ward corner: rotate (px, py)
// back onto the genomic axis. The view transform maps data-x = 0 back to the
// payload's `originBp`, so this is where the ruler expects the cell.
function cellLeftAxisBp(d: HicDataResult, i: number) {
  return (
    (getInstancePosition(d.instances, i, 0) +
      getInstancePosition(d.instances, i, 1)) *
    ROT_45
  )
}

function diagonal(regionIdx: number, bin: number): TestContact {
  return {
    bin1: bin,
    bin2: bin,
    counts: 1,
    region1Idx: regionIdx,
    region2Idx: regionIdx,
  }
}

// `dynamicBlocks` elides any displayed region narrower than minimumBlockWidth
// and `contentBlocks` drops elided blocks — but the ruler still gives them
// their axis span. The axis offsets the model resolves carry that gap, and the
// worker must lay regions out at them rather than as a running sum of the
// spans it was handed.
describe('region layout follows the axis offsets, not a running sum of spans', () => {
  test('a gap left by an elided region keeps later regions in place', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'c', start: 0, end: 500, assemblyName: 'asm' },
    ]
    // region 'b' (2bp of axis) elided between them: 'c' starts at 502, not 500
    const offsets = [0, 502]
    const d = await run(regions, offsets, [diagonal(0, 1), diagonal(1, 1)])

    // cell left corner = regionOffsetBp + (bin*res - start)
    expect(cellLeftAxisBp(d, 0)).toBeCloseTo(100, 3)
    expect(cellLeftAxisBp(d, 1)).toBeCloseTo(602, 3)
  })

  test('the hover bounds carry the gap too, so spans stay disjoint', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'c', start: 0, end: 500, assemblyName: 'asm' },
    ]
    const d = await run(regions, [0, 502], [diagonal(0, 0)])
    expect(d.regions[0]!.dataXStart).toBeCloseTo(0, 6)
    expect(d.regions[0]!.dataXEnd).toBeCloseTo(500 * ROT_45, 6)
    // region 1 starts past where region 0 ends — the 2bp elided gap
    expect(d.regions[1]!.dataXStart).toBeCloseTo(502 * ROT_45, 6)
    expect(d.regions[1]!.dataXEnd).toBeCloseTo(1002 * ROT_45, 6)
  })

  test('contiguous regions are unchanged', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'b', start: 0, end: 500, assemblyName: 'asm' },
    ]
    const d = await run(regions, [0, 500], [diagonal(0, 1), diagonal(1, 1)])
    expect(cellLeftAxisBp(d, 0)).toBeCloseTo(100, 3)
    expect(cellLeftAxisBp(d, 1)).toBeCloseTo(600, 3)
  })
})

// The axis is the concatenation of displayedRegions in display order — every
// region counts toward the cumulative offset (elided ones included, since the
// ruler still gives them their width), a block in a reversed region leads with
// its `end`, and offsets come back relative to the leftmost fetched block.
describe('calcAxisBlocks', () => {
  const displayed = [
    { start: 0, end: 1000 },
    { start: 0, end: 2 },
    { start: 100, end: 600 },
    { start: 0, end: 400, reversed: true },
  ]

  test('a block at its region start sits at the cumulative bp offset', () => {
    const { originBp, axisBlocks } = calcAxisBlocks(
      [
        {
          refName: 'a',
          start: 0,
          end: 1000,
          displayedRegionIndex: 0,
        },
        {
          refName: 'c',
          start: 100,
          end: 600,
          displayedRegionIndex: 2,
        },
      ],
      displayed,
    )
    expect(originBp).toBe(0)
    // region 2's axis start = 1000 + 2 (the elided middle region still counts)
    expect(axisBlocks.map(b => b.offsetBp)).toEqual([0, 1002])
  })

  test('offsets are relative to the leftmost fetched block', () => {
    const { originBp, axisBlocks } = calcAxisBlocks(
      [
        {
          refName: 'c',
          start: 300,
          end: 600,
          displayedRegionIndex: 2,
        },
      ],
      displayed,
    )
    // axis start of region 2 (1002) + block lead within it (300 - 100)
    expect(originBp).toBe(1202)
    expect(axisBlocks[0]!.offsetBp).toBe(0)
  })

  test('a block in a reversed region leads with its end', () => {
    const { originBp, axisBlocks } = calcAxisBlocks(
      [
        {
          refName: 'd',
          start: 0,
          end: 300,
          displayedRegionIndex: 3,
        },
      ],
      displayed,
    )
    // region 3's axis start = 1000 + 2 + 500 = 1502; reversed lead = 400 - 300
    expect(originBp).toBe(1602)
    expect(axisBlocks[0]!.offsetBp).toBe(0)
  })

  // the view's names, not the adapter's: the RPC framework renames
  // `regions[].refName` on the way out, so hover labels would otherwise read
  // the .hic file's chromosome names under a ruler showing the assembly's
  test('carries the refName the view displays', () => {
    const { axisBlocks } = calcAxisBlocks(
      [{ refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 }],
      [{ start: 0, end: 1000 }],
    )
    expect(axisBlocks[0]!.refName).toBe('chr1')
  })
})
