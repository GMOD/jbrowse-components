import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { calcViewBlocks } from '../regionOffsets.ts'
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
const BP_PER_PX = 1
const ROT_45 = Math.SQRT1_2

async function run(
  regions: Region[],
  regionOffsetsPx: number[],
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
      viewBlocks: regions.map((r, i) => ({
        refName: r.refName,
        offsetPx: regionOffsetsPx[i]!,
      })),
      bpPerPx: BP_PER_PX,
      resolution: RES,
      normalization: 'KR',
    },
  })
  return (out as unknown as { value: HicDataResult }).value
}

// Genomic-px position of a diagonal cell's apex-ward corner: rotate (px, py)
// back onto the genomic axis. `renderTransform` puts that axis's origin at the
// apex, so this is where the ruler expects the cell.
function cellLeftGenomicPx(d: HicDataResult, i: number) {
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
// and `contentBlocks` drops elided blocks — but the ruler still gives them their
// width. The worker used to lay regions out as a running sum of the widths it
// was handed, which slid every region after an elided one leftward of its true
// position (whole-genome Hi-C over an assembly with small scaffolds).
describe('region layout follows the view, not a running sum of widths', () => {
  test('a gap left by an elided region keeps later regions in place', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'c', start: 0, end: 500, assemblyName: 'asm' },
    ]
    // region 'b' (2px wide) elided between them: 'c' starts at 502px, not 500
    const offsets = [0, 502]
    const d = await run(regions, offsets, [diagonal(0, 1), diagonal(1, 1)])

    // cell left corner = regionOffsetPx + (bin*res - start)/bpPerPx
    expect(cellLeftGenomicPx(d, 0)).toBeCloseTo(100, 3)
    expect(cellLeftGenomicPx(d, 1)).toBeCloseTo(602, 3)
  })

  test('the hover bounds carry the gap too, so spans stay disjoint', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'c', start: 0, end: 500, assemblyName: 'asm' },
    ]
    const d = await run(regions, [0, 502], [diagonal(0, 0)])
    expect(d.regions[0]!.dataXStart).toBeCloseTo(0, 6)
    expect(d.regions[0]!.dataXEnd).toBeCloseTo(500 * ROT_45, 6)
    // region 1 starts past where region 0 ends — the 2px elided gap
    expect(d.regions[1]!.dataXStart).toBeCloseTo(502 * ROT_45, 6)
    expect(d.regions[1]!.dataXEnd).toBeCloseTo(1002 * ROT_45, 6)
  })

  test('contiguous regions are unchanged', async () => {
    const regions: Region[] = [
      { refName: 'a', start: 0, end: 500, assemblyName: 'asm' },
      { refName: 'b', start: 0, end: 500, assemblyName: 'asm' },
    ]
    const d = await run(regions, [0, 500], [diagonal(0, 1), diagonal(1, 1)])
    expect(cellLeftGenomicPx(d, 0)).toBeCloseTo(100, 3)
    expect(cellLeftGenomicPx(d, 1)).toBeCloseTo(600, 3)
  })
})

// The apex the offsets are measured from is `max(0, view.offsetPx)`, which is
// exactly what `renderTransform` maps data-x = 0 back to.
describe('calcViewBlocks', () => {
  const offsets = (
    blocks: { refName: string; offsetPx: number }[],
    at: number,
  ) => calcViewBlocks(blocks, at).map(b => b.offsetPx)

  test('the first content block sits at the apex', () => {
    expect(offsets([{ refName: 'a', offsetPx: 300 }], 300)).toEqual([0])
  })

  test('scrolled left of genome start, the apex is still 0', () => {
    // the view is at -40, but block layout clamps the first block to 0
    expect(offsets([{ refName: 'a', offsetPx: 0 }], -40)).toEqual([0])
  })

  test('a later region keeps its distance from the apex', () => {
    expect(
      offsets(
        [
          { refName: 'a', offsetPx: 300 },
          { refName: 'b', offsetPx: 812 },
        ],
        300,
      ),
    ).toEqual([0, 512])
  })

  // the view's names, not the adapter's: the RPC framework renames
  // `regions[].refName` on the way out, so hover labels would otherwise read
  // the .hic file's chromosome names under a ruler showing the assembly's
  test('carries the refName the view displays', () => {
    expect(
      calcViewBlocks([{ refName: 'chr1', offsetPx: 0 }], 0)[0]!.refName,
    ).toBe('chr1')
  })
})
