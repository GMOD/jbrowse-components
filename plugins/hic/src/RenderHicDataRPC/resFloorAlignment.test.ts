import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { executeRenderHicData } from './executeRenderHicData.ts'

import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

interface Rec {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
}

const ROT_45 = Math.SQRT1_2

async function run(
  region: Region,
  records: Rec[],
  bpPerPx: number,
  res: number,
) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve({ records, resolution: res }),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const out = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [region],
      bpPerPx,
      resolution: res,
      normalization: 'KR',
    },
  })
  return (out as unknown as { value: HicDataResult }).value
}

// Genomic-px position of a cell's apex-ward (min) corner: rotate (px, py) onto
// the genomic axis. `renderTransform` places this axis's origin at the block's
// actual start, so this is where the ruler expects the cell — no dependence on
// the internal offset math, so it can't bake in what the code currently does.
function cellLeftGenomicPx(d: HicDataResult, i: number) {
  return (d.positions[i * 2]! + d.positions[i * 2 + 1]!) * ROT_45
}

// A diagonal contact (bin1 === bin2 === b) draws a diamond whose left corner
// sits at bin b's left genomic edge: `b * res` bp, i.e. `(b*res - start)/bpPerPx`
// px relative to the block start. This is the regression the res-floor bug hit:
// flooring `start/res` drew every cell of a sub-res-offset block snapped to the
// block edge instead of its true genomic position.
describe('hic matrix aligns to the ruler on a non-res-aligned block start', () => {
  test.each([0, 50, 99, 137])(
    'start=%i draws cells at true genomic px',
    async start => {
      const res = 100
      const bpPerPx = 1
      const bins = [0, 3, 9]
      const records: Rec[] = bins.map(b => ({
        bin1: b,
        bin2: b,
        counts: 1,
        region1Idx: 0,
        region2Idx: 0,
      }))
      const d = await run(
        { refName: 'a', start, end: start + 1000, assemblyName: 'a' },
        records,
        bpPerPx,
        res,
      )
      bins.forEach((b, i) => {
        expect(cellLeftGenomicPx(d, i)).toBeCloseTo(
          (b * res - start) / bpPerPx,
          3,
        )
      })
    },
  )
})
