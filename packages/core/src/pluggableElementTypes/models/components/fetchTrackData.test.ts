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

function setup({ exportsData }: { exportsData: boolean }) {
  jest.mocked(getConf).mockReturnValue(adapterConfig)
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

const model = {} as IAnyStateTreeNode

beforeEach(() => {
  call.mockReset()
  writer.mockClear()
})

test('an adapter that exports the format returns its raw lines', async () => {
  setup({ exportsData: true })
  call.mockResolvedValue('@HD\tVN:1.6\nread1\t0\tctgA')

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
  const feats = [feature('read1'), feature('read2')]
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetExportData' ? undefined : feats,
  )

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({
    str: 'read1,read2',
    features: feats,
    usedAdapterExport: false,
  })
  expect(callsTo('CoreGetExportData')).toHaveLength(1)
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)
})

test('the stop token and status callback reach both RPCs', async () => {
  setup({ exportsData: true })
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetExportData' ? undefined : [],
  )
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

  for (const method of ['CoreGetExportData', 'CoreGetFeatures']) {
    expect(callsTo(method)[0]![2]).toMatchObject({ stopToken, statusCallback })
  }
})

test('handed-back features are reused instead of re-reading the region', async () => {
  setup({ exportsData: false })
  const feats = [feature('gene1')]
  call.mockResolvedValue(feats)

  const first = await fetchTrackData({ model, regions, type: 'bed', options })
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)

  const second = await fetchTrackData({
    model,
    regions,
    type: 'sam',
    options,
    features: first.features,
  })

  // the point of the cache: a format change reruns the writer, not the read
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)
  expect(second.features).toBe(feats)
  expect(second.str).toBe('gene1')
  expect(writer).toHaveBeenCalledTimes(2)
})

test('cached features do not short-circuit the next format’s export attempt', async () => {
  setup({ exportsData: true })
  const feats = [feature('read1')]
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetExportData' ? undefined : feats,
  )

  const first = await fetchTrackData({ model, regions, type: 'bed', options })
  call.mockResolvedValue('@HD\tVN:1.6')

  const second = await fetchTrackData({
    model,
    regions,
    type: 'sam',
    options,
    features: first.features,
  })

  // an adapter exporting some formats and not others gets asked about each one:
  // the next format may be one it does write, and the raw lines beat a
  // reconstruction built from the features the previous format happened to read
  expect(second).toEqual({ str: '@HD\tVN:1.6', usedAdapterExport: true })
  expect(callsTo('CoreGetExportData')).toHaveLength(2)
})

test('a second declined format reuses what the first one read', async () => {
  setup({ exportsData: true })
  const feats = [feature('read1')]
  call.mockImplementation(async (_sessionId, method) =>
    method === 'CoreGetExportData' ? undefined : feats,
  )

  const first = await fetchTrackData({ model, regions, type: 'bed', options })
  const second = await fetchTrackData({
    model,
    regions,
    type: 'sam',
    options,
    features: first.features,
  })

  expect(callsTo('CoreGetExportData')).toHaveLength(2)
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)
  expect(second.str).toBe('read1')
})
