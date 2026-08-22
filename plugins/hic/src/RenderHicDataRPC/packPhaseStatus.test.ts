import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, RpcStatus } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 100

// Packing a whole-genome matrix is hundreds of ms of per-contact work after the
// download's phase has closed, so the field it runs under must not be the blank
// one it used to be.
test('the pack after the download reports its own determinate phase', async () => {
  const contacts = Array.from({ length: 8 }, (_, i) => ({
    bin1: i,
    bin2: i,
    counts: 1,
    region1Idx: i < 4 ? 0 : 1,
    region2Idx: i < 4 ? 0 : 1,
  }))
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve(toContacts(contacts, RES)),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000 },
  ]
  const statuses: RpcStatus[] = []

  await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions,
      axisBlocks: regions.map(r => ({ refName: r.refName, offsetBp: 0 })),
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
      statusCallback: status => {
        statuses.push(status)
      },
    },
  })

  // Emission is time-gated at 100ms, so past the opening 0% only the phase's end
  // is guaranteed — the bar is contact-weighted either way, which is what the
  // total says.
  expect(statuses).toContainEqual({
    message: 'Building contact matrix',
    current: 0,
    total: 8,
  })
  // and it retires, or it goes on voting for a phase that is over
  expect(statuses.at(-1)).toBe('')
})
