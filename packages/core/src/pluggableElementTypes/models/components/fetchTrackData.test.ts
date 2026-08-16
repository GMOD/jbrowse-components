import { getConf } from '../../../configuration/getConf.ts'
import { getEnv, getSession } from '../../../util/mstUtils.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'
import { fetchTrackData } from './fetchTrackData.ts'

import type { Feature, Region } from '../../../util/index.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// The dialog reaches the adapter through four seams and nothing else, so
// standing them up is what lets this test be about the branching rather than
// about MST. `configuration/index.ts` and `util/index.ts` re-export these, so
// mocking the defining module is enough for fetchTrackData's own imports.
jest.mock('../../../configuration/getConf.ts', () => ({
  ...jest.requireActual('../../../configuration/getConf.ts'),
  getConf: jest.fn(),
}))
jest.mock('../../../util/mstUtils.ts', () => ({
  ...jest.requireActual('../../../util/mstUtils.ts'),
  getEnv: jest.fn(),
  getSession: jest.fn(),
}))
jest.mock('../../../util/tracks.ts', () => ({
  ...jest.requireActual('../../../util/tracks.ts'),
  getRpcSessionId: jest.fn(),
}))

const adapterConfig = { type: 'TestAdapter' }
const regions: Region[] = [
  { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
]

function feature(name: string) {
  return new SimpleFeature({
    uniqueId: name,
    refName: 'ctgA',
    start: 0,
    end: 10,
    name,
  })
}

// names the features it was handed, so a result says which features produced it
const writer = jest.fn(({ features }: { features: Feature[] }) =>
  features.map(f => f.get('name')).join(','),
)

const options: Record<string, FileTypeExporter> = {
  sam: { name: 'SAM', extension: 'sam', callback: writer },
  bed: { name: 'BED', extension: 'bed', callback: writer },
}

const call = jest.fn()

function setup({
  exportsData = false,
  fetchSizeLimit,
}: {
  exportsData?: boolean
  fetchSizeLimit?: number
} = {}) {
  jest
    .mocked(getConf)
    .mockImplementation((_model: unknown, path?: unknown) =>
      Array.isArray(path) && path[1] === 'fetchSizeLimit'
        ? fetchSizeLimit
        : adapterConfig,
    )
  jest.mocked(getRpcSessionId).mockReturnValue('session-1')
  jest.mocked(getEnv).mockReturnValue({
    pluginManager: {
      getAdapterType: () => ({
        adapterCapabilities: exportsData ? ['exportData'] : [],
      }),
    },
  } as unknown as ReturnType<typeof getEnv>)
  jest.mocked(getSession).mockReturnValue({
    rpcManager: { call },
  } as unknown as ReturnType<typeof getSession>)
}

function callsTo(method: string) {
  return call.mock.calls.filter(c => c[1] === method)
}

// the shape every test but the size ones wants: an unmeasurable region, so
// nothing gates and the branch under test is the only thing deciding
function respond(handlers: Record<string, unknown>) {
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetRegionByteEstimate' ? undefined : handlers[method],
  )
}

const model = {} as IAnyStateTreeNode

beforeEach(() => {
  call.mockReset()
  writer.mockClear()
})

test('an adapter that exports the format returns its raw lines', async () => {
  setup({ exportsData: true })
  respond({ CoreGetExportData: '@HD\tVN:1.6\nread1\t0\tctgA' })

  const res = await fetchTrackData({ model, regions, type: 'sam', options })

  expect(res).toEqual({
    str: '@HD\tVN:1.6\nread1\t0\tctgA',
    usedAdapterExport: true,
  })
  expect(callsTo('CoreGetExportData')[0]![2]).toMatchObject({
    adapterConfig,
    regions,
    formatType: 'sam',
  })
  // the raw lines are the answer: no features read, no writer run
  expect(callsTo('CoreGetFeatures')).toHaveLength(0)
  expect(writer).not.toHaveBeenCalled()
})

test('an adapter declining one format falls through to the features', async () => {
  setup({ exportsData: true })
  respond({
    CoreGetExportData: undefined,
    CoreGetFeatures: [feature('read1'), feature('read2')],
  })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({ str: 'read1,read2', usedAdapterExport: false })
  expect(callsTo('CoreGetExportData')).toHaveLength(1)
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)
})

test('a track with no export capability is never asked to export', async () => {
  setup()
  respond({ CoreGetFeatures: [feature('gene1')] })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({ str: 'gene1', usedAdapterExport: false })
  expect(callsTo('CoreGetExportData')).toHaveLength(0)
})

test('the stop token and status callback reach every RPC', async () => {
  setup({ exportsData: true })
  respond({ CoreGetExportData: undefined, CoreGetFeatures: [] })
  const stopToken = 'token-1'
  const statusCallback = jest.fn()

  await fetchTrackData({
    model,
    regions,
    type: 'bed',
    options,
    stopToken,
    statusCallback,
  })

  for (const method of [
    'CoreGetRegionByteEstimate',
    'CoreGetExportData',
    'CoreGetFeatures',
  ]) {
    expect(callsTo(method)[0]![2]).toMatchObject({ stopToken, statusCallback })
  }
})

test('a region over budget downloads nothing and says what it would cost', async () => {
  setup({ fetchSizeLimit: 1_000_000 })
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetRegionByteEstimate' ? 4_000_000 : [feature('gene1')],
  )

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({
    str: '',
    usedAdapterExport: false,
    tooLarge: { bytes: 4_000_000, limit: 1_000_000 },
  })
  expect(callsTo('CoreGetFeatures')).toHaveLength(0)
  expect(writer).not.toHaveBeenCalled()
})

test('force skips the pre-flight entirely', async () => {
  setup({ fetchSizeLimit: 1_000_000 })
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetRegionByteEstimate' ? 4_000_000 : [feature('gene1')],
  )

  const res = await fetchTrackData({
    model,
    regions,
    type: 'bed',
    options,
    force: true,
  })

  expect(res).toEqual({ str: 'gene1', usedAdapterExport: false })
  expect(callsTo('CoreGetRegionByteEstimate')).toHaveLength(0)
})

test('an adapter quoting no estimate does not gate', async () => {
  setup({ fetchSizeLimit: 1 })
  respond({ CoreGetFeatures: [feature('gene1')] })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({ str: 'gene1', usedAdapterExport: false })
})

test('an adapter declaring no limit falls back to the default budget', async () => {
  setup()
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetRegionByteEstimate' ? 6_000_000 : [feature('gene1')],
  )

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res.tooLarge).toEqual({ bytes: 6_000_000, limit: 5_000_000 })
})
