import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import { getInstancePosition } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { executeRenderHicData } from '../RenderHicDataRPC/executeRenderHicData.ts'
import AlignmentsContactAdapter from './AlignmentsContactAdapter.ts'
import configSchema from './configSchema.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Region } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 750
const PAIRED = 0x1
const FIRST_IN_PAIR = 0x40

// One LL pair spanning the two breakpoints of an inversion, the signature the
// spike's chr7 capture shows as a pair of dots.
const inversionPair = new SimpleFeature({
  uniqueId: 'll',
  refName: '7',
  start: 1000,
  end: 1148,
  strand: 1,
  flags: PAIRED | FIRST_IN_PAIR,
  next_ref: '7',
  next_pos: 11000,
})

function buildAdapter() {
  const getSubAdapter = (() =>
    Promise.resolve({
      dataAdapter: {
        setSequenceAdapterConfig: () => {},
        getRefNames: () => Promise.resolve(['7']),
        getFeatures: () =>
          ObservableCreate<SimpleFeature>(observer => {
            observer.next(inversionPair)
            observer.complete()
          }),
      },
      sessionIds: new Set(['test']),
    })) as unknown as getSubAdapterType
  return new AlignmentsContactAdapter(
    configSchema.create({
      type: 'AlignmentsContactAdapter',
      channel: 'sameStrand',
      subadapter: { type: 'BamAdapter' },
    }) as AnyConfigurationModel,
    getSubAdapter,
  )
}

async function render(regions: Region[]) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: buildAdapter(),
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const out = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      axisBlocks: regions.map(r => ({ refName: r.refName, offsetBp: 0 })),
      originBp: 0,
      resolution: RES,
      normalization: 'NONE',
    },
  })
  return (out as unknown as { value: HicDataResult }).value
}

// Instance positions are pre-rotation data-x, i.e. axis bp / sqrt(2).
function axisBp(data: HicDataResult, i: number, word: 0 | 1) {
  return getInstancePosition(data.instances, i, word) * Math.SQRT2
}

test('the RPC packs what the adapter hands it', async () => {
  const data = await render([
    { refName: '7', start: 0, end: 30000, assemblyName: 'test' },
  ])

  expect(data.numContacts).toBe(1)
  expect(data.resolution).toBe(RES)
  expect(data.appliedNormalization).toBe('NONE')
  expect(data.binWidth).toBeCloseTo(RES / Math.SQRT2)
  expect(data.maxScore).toBe(1)
  expect(data.percentile95).toBe(1)
  expect(data.pairRuns).toEqual([
    { region1Idx: 0, region2Idx: 0, start: 0, end: 1 },
  ])
  expect(data.regions).toHaveLength(1)
  expect(axisBp(data, 0, 0)).toBeCloseTo(1 * RES)
  expect(axisBp(data, 0, 1)).toBeCloseTo(14 * RES)
})
