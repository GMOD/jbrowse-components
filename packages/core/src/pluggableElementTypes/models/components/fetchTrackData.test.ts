import { getConf } from '../../../configuration/getConf.ts'
import { getSession } from '../../../util/mstUtils.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'
import { exportRegions, fetchTrackData } from './fetchTrackData.ts'

import type { Feature, Region } from '../../../util/index.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { ExportableTrack } from './fetchTrackData.ts'

// Everything the export reads off the track is a getter on it, so a plain
// object is the whole model here; only the three tree lookups need standing up.
// `configuration/index.ts` and `util/index.ts` re-export these, so mocking the
// defining module is enough for fetchTrackData's own imports.
jest.mock('../../../configuration/getConf.ts', () => ({
  ...jest.requireActual('../../../configuration/getConf.ts'),
  getConf: jest.fn(),
}))
jest.mock('../../../util/mstUtils.ts', () => ({
  ...jest.requireActual('../../../util/mstUtils.ts'),
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

let model: ExportableTrack

function setup({
  exportsData = false,
  byteLimit = 5_000_000,
}: {
  exportsData?: boolean
  byteLimit?: number
} = {}) {
  model = {
    exportsDataViaAdapter: exportsData,
    exportByteLimit: byteLimit,
  } as unknown as ExportableTrack
  jest.mocked(getConf).mockReturnValue(adapterConfig)
  jest.mocked(getRpcSessionId).mockReturnValue('session-1')
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

beforeEach(() => {
  call.mockReset()
  writer.mockClear()
})

// what an LGV block looks like: whole-base bounds plus the screen geometry and
// `reversed` flag the dialog's region label picked up as a stray "[rev]"
test('exportRegions widens to whole bases and drops the view geometry', () => {
  expect(
    exportRegions([
      {
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 100.7,
        end: 200.2,
        reversed: true,
        displayedRegionIndex: 0,
        screenStartPx: 0,
        screenEndPx: 800,
      } as Region,
    ]),
  ).toEqual([{ assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 201 }])
})

// two LGV blocks side by side: widened, they share base 200
test('exportRegions joins regions of one sequence that touch or overlap', () => {
  const region = (refName: string, start: number, end: number) => ({
    assemblyName: 'volvox',
    refName,
    start,
    end,
  })
  expect(
    exportRegions([
      region('ctgB', 0, 50),
      region('ctgA', 300, 400),
      region('ctgA', 100.5, 200.5),
      region('ctgA', 200.5, 250),
      region('ctgB', 40, 60),
    ]),
  ).toEqual([
    region('ctgB', 0, 60),
    region('ctgA', 100, 250),
    region('ctgA', 300, 400),
  ])
})

test('an adapter that exports the format returns its raw lines', async () => {
  setup({ exportsData: true })
  respond({ CoreGetExportData: '@HD\tVN:1.6\nread1\t0\tctgA' })

  const res = await fetchTrackData({ model, regions, type: 'sam', options })

  expect(res).toEqual({
    str: '@HD\tVN:1.6\nread1\t0\tctgA\n',
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

  expect(res).toEqual({ str: 'read1,read2\n', usedAdapterExport: false })
  expect(callsTo('CoreGetExportData')).toHaveLength(1)
  expect(callsTo('CoreGetFeatures')).toHaveLength(1)
})

test('a track with no export capability is never asked to export', async () => {
  setup()
  respond({ CoreGetFeatures: [feature('gene1')] })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({ str: 'gene1\n', usedAdapterExport: false })
  expect(callsTo('CoreGetExportData')).toHaveLength(0)
})

test('the signal and status callback reach every RPC', async () => {
  setup({ exportsData: true })
  respond({ CoreGetExportData: undefined, CoreGetFeatures: [] })
  const { signal } = new AbortController()
  const statusCallback = jest.fn()

  await fetchTrackData({
    model,
    regions,
    type: 'bed',
    options,
    signal,
    statusCallback,
  })

  for (const method of [
    'CoreGetRegionByteEstimate',
    'CoreGetExportData',
    'CoreGetFeatures',
  ]) {
    expect(callsTo(method)[0]![2]).toMatchObject({ signal, statusCallback })
  }
})

test('a region over budget downloads nothing and says what it would cost', async () => {
  setup({ byteLimit: 1_000_000 })
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
  setup({ byteLimit: 1_000_000 })
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

  expect(res).toEqual({ str: 'gene1\n', usedAdapterExport: false })
  expect(callsTo('CoreGetRegionByteEstimate')).toHaveLength(0)
})

test('an adapter quoting no estimate does not gate', async () => {
  setup({ byteLimit: 1 })
  respond({ CoreGetFeatures: [feature('gene1')] })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res).toEqual({ str: 'gene1\n', usedAdapterExport: false })
})

// GenBank fetches its ORIGIN sequence from inside the writer, so the pair has
// to travel one hop further than the RPCs above
test('the signal and status callback reach the writer too', async () => {
  setup()
  respond({ CoreGetFeatures: [feature('gene1')] })
  const { signal } = new AbortController()
  const statusCallback = jest.fn()

  await fetchTrackData({
    model,
    regions,
    type: 'bed',
    options,
    signal,
    statusCallback,
  })

  expect(writer).toHaveBeenCalledWith(
    expect.objectContaining({ signal, statusCallback }),
  )
})

test('an empty export stays empty rather than becoming one newline', async () => {
  setup()
  respond({ CoreGetFeatures: [] })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res.str).toBe('')
})

test('a writer handed no features is not run', async () => {
  setup()
  respond({ CoreGetFeatures: [] })

  await fetchTrackData({ model, regions, type: 'bed', options })

  expect(writer).not.toHaveBeenCalled()
})

// a collapsed-introns view asks for one region per exon, and the gene
// overlapping all of them comes back from each
test('a feature returned for several regions is written once', async () => {
  setup()
  respond({
    CoreGetFeatures: [feature('gene1'), feature('gene2'), feature('gene1')],
  })

  const res = await fetchTrackData({ model, regions, type: 'bed', options })

  expect(res.str).toBe('gene1,gene2\n')
})
