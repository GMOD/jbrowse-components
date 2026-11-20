import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import HicAdapter from '../HicAdapter/HicAdapter.ts'
import configSchema from '../HicAdapter/configSchema.ts'
import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { findContactAt } from '../LinearHicDisplay/contactLookup.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'

import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const HIC = require.resolve('../../../../extra_test_data/test.hic')
const RES = 2_500_000
const CHR1 = 249_250_621

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

beforeEach(() => {
  const dataAdapter = new HicAdapter(
    configSchema.create({
      hicLocation: { localPath: HIC, locationType: 'LocalPathLocation' },
    }),
  )
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter,
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
})

async function render(regions: Region[]) {
  let offsetBp = 0
  const axisBlocks = regions.map(r => {
    const block = { refName: r.refName, offsetBp }
    offsetBp += r.end - r.start
    return block
  })
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      axisBlocks,
      originBp: 0,
      binSize: RES,
      normalization: 'KR',
      field: 'observed/expected',
      quantile: 0.95,
    },
  })
  return (res as unknown as { value: HicDataResult }).value
}

// each cell read back the way the hover does, at the drawn cell's centre
function readCells(data: HicDataResult) {
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
  return byCell
}

test('observed/expected over a real file matches straw', async () => {
  const data = await render([
    { assemblyName: 'hg19', refName: '1', start: 0, end: CHR1 },
    { assemblyName: 'hg19', refName: '2', start: 0, end: 243_199_373 },
  ])
  expect(data.appliedField).toBe('observed/expected')
  const byCell = readCells(data)
  for (const { bin1, bin2, r1, r2, oe } of STRAW) {
    expect(byCell.get(`${r1}_${r2}_${bin1}_${bin2}`)).toBeCloseTo(oe, 4)
  }
})

// Two windows apart on one chromosome read the expected vector from the
// nearest distance between them, so each cell indexes past that first one.
test('two regions apart on one chromosome read the ratio a spanning region does', async () => {
  const apart = readCells(
    await render([
      { assemblyName: 'hg19', refName: '1', start: 0, end: 100_000_000 },
      { assemblyName: 'hg19', refName: '1', start: 150_000_000, end: CHR1 },
    ]),
  )
  const spanning = readCells(
    await render([{ assemblyName: 'hg19', refName: '1', start: 0, end: CHR1 }]),
  )
  const between = [...apart].filter(([key]) => key.startsWith('0_1_'))
  expect(between.length).toBeGreaterThan(1000)
  for (const [key, value] of between) {
    const [, , bin1, bin2] = key.split('_')
    expect(value).toBeCloseTo(spanning.get(`0_0_${bin1}_${bin2}`)!, 5)
  }
})
