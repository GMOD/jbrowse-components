import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import HicAdapter from '../HicAdapter/HicAdapter.ts'
import configSchema from '../HicAdapter/configSchema.ts'
import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { findContactAt } from '../LinearHicDisplay/contactLookup.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'

import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const HIC = require.resolve('../../../../extra_test_data/test.hic')
const RES = 2_500_000

// straw's own `oe` for these cells of test.hic under KR, the values
// @gmod/hic's scripts/oe-oracle.py records: an independent reader, so the
// adapter, the worker and the hover agreeing with it checks the whole path
const STRAW = [
  { bin1: 0, bin2: 0, r1: 0, r2: 0, oe: 1.4150800704956055 },
  { bin1: 4, bin2: 5, r1: 0, r2: 0, oe: 0.9078593850135803 },
  { bin1: 2, bin2: 8, r1: 0, r2: 0, oe: 1.0761098861694336 },
  { bin1: 45, bin2: 0, r1: 0, r2: 1, oe: 1.368892788887024 },
  { bin1: 2, bin2: 1, r1: 0, r2: 1, oe: 1.1582651138305664 },
]

test('observed/expected over a real file matches straw', async () => {
  const dataAdapter = new HicAdapter(
    configSchema.create({
      hicLocation: { localPath: HIC, locationType: 'LocalPathLocation' },
    }),
  )
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter,
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const regions = [
    { assemblyName: 'hg19', refName: '1', start: 0, end: 249_250_621 },
    { assemblyName: 'hg19', refName: '2', start: 0, end: 243_199_373 },
  ]
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      axisBlocks: [
        { refName: '1', offsetBp: 0 },
        { refName: '2', offsetBp: 249_250_621 },
      ],
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
      field: 'observed/expected',
      quantile: 0.95,
    },
  })
  const data = (res as unknown as { value: HicDataResult }).value
  expect(data.appliedField).toBe('observed/expected')

  // read each cell back the way the hover does: the drawn cell's centre
  const byCell = new Map<string, number>()
  for (let i = 0; i < data.numContacts; i++) {
    const hit = findContactAt(
      data,
      getInstancePosition(data.instances, i, 0) + data.binWidth / 2,
      getInstancePosition(data.instances, i, 1) + data.binWidth / 2,
    )!
    byCell.set(
      `${hit.region1Idx}_${hit.region2Idx}_${hit.bin1}_${hit.bin2}`,
      hit.value,
    )
  }
  for (const { bin1, bin2, r1, r2, oe } of STRAW) {
    expect(byCell.get(`${r1}_${r2}_${bin1}_${bin2}`)).toBeCloseTo(oe, 4)
  }
})
