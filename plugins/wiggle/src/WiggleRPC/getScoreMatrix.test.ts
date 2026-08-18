import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'

import { MultiWiggleGetScoreMatrix } from './MultiWiggleGetScoreMatrix.ts'
import { getScoreMatrix } from './getScoreMatrix.ts'

import type { GetScoreMatrixArgs } from './types.ts'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

// Both are real rather than cast stubs: getFeatureAdapterOrThrow is mocked, so
// neither is read, and a real one costs nothing.
const pm = new PluginManager()
const adapterConfig = ConfigurationSchema('MultiWiggleAdapter', {}).create({})

function feat(source: string, start: number, end: number, score: number) {
  return new SimpleFeature({
    uniqueId: `${source}-${start}`,
    refName: 'chr1',
    start,
    end,
    score,
    source,
  })
}

function region(refName: string, start: number, end: number): Region {
  return { refName, start, end, assemblyName: 'hg38' }
}

function callArgs({
  regions,
  sources,
  bpPerPx,
}: {
  regions: Region[]
  sources: string[]
  bpPerPx: number
}) {
  return {
    sessionId: 'sid',
    adapterConfig,
    regions,
    bpPerPx,
    sources: sources.map(name => ({ name, source: name })),
  } satisfies GetScoreMatrixArgs & RpcCallContext
}

// A plain feature adapter carrying several sources in one file (bedMethyl):
// grouped on the `source` field, one call per region.
async function run(opts: {
  features: Feature[] | Feature[][]
  regions: Region[]
  sources: string[]
  bpPerPx: number
}) {
  const { features, regions } = opts
  const perRegion = Array.isArray(features[0]) ? features : [features]
  const getFeaturesArray = jest
    .fn()
    .mockImplementation((r: Region) =>
      Promise.resolve(perRegion[regions.indexOf(r)] ?? []),
    )
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockResolvedValue({ getFeaturesArray } as never)

  return getScoreMatrix({ pluginManager: pm, args: callArgs(opts) })
}

describe('getScoreMatrix', () => {
  it('bins a feature across every column it spans', async () => {
    const rows = await run({
      features: [feat('a', 0, 50, 7)],
      regions: [region('chr1', 0, 100)],
      sources: ['a'],
      bpPerPx: 10,
    })
    expect(Array.from(rows.get('a')!)).toEqual([7, 7, 7, 7, 7, 0, 0, 0, 0, 0])
  })

  // A bedGraph/bedMethyl subtrack (the modkit use-case) has base-resolution
  // features that are far narrower than a sampling bin at anything but the
  // deepest zoom. Truncating both edges dropped every one of them, so the
  // matrix handed to the clusterer was all zeros and the dendrogram it
  // returned described nothing.
  it('keeps a feature narrower than one bin', async () => {
    const rows = await run({
      features: [feat('a', 25, 26, 3), feat('a', 71, 72, 5)],
      regions: [region('chr1', 0, 100)],
      sources: ['a'],
      bpPerPx: 10,
    })
    expect(Array.from(rows.get('a')!)).toEqual([0, 0, 3, 0, 0, 0, 0, 5, 0, 0])
  })

  it('leaves a source with no features an all-zero row', async () => {
    const rows = await run({
      features: [feat('a', 0, 100, 4)],
      regions: [region('chr1', 0, 100)],
      sources: ['a', 'b'],
      bpPerPx: 50,
    })
    expect(Array.from(rows.get('a')!)).toEqual([4, 4])
    expect(Array.from(rows.get('b')!)).toEqual([0, 0])
  })

  // Every visible block contributes a segment; a whole-genome or
  // collapsed-intron view has to cluster on all of them concatenated, not just
  // the first.
  it('concatenates one segment per region', async () => {
    const rows = await run({
      features: [[feat('a', 0, 100, 1)], [feat('a', 0, 100, 2)]],
      regions: [region('chr1', 0, 100), region('chr2', 0, 100)],
      sources: ['a'],
      bpPerPx: 50,
    })
    expect(Array.from(rows.get('a')!)).toEqual([1, 1, 2, 2])
  })

  it('clips a feature hanging off either end of its region', async () => {
    const rows = await run({
      features: [feat('a', -40, 30, 9)],
      regions: [region('chr1', 0, 50)],
      sources: ['a'],
      bpPerPx: 10,
    })
    expect(Array.from(rows.get('a')!)).toEqual([9, 9, 9, 0, 0])
  })

  // Several features per column is the norm for base-resolution data at any
  // real zoom, so the column reports their mean rather than whichever one the
  // adapter emitted last. A BigWig zoom bin is already a mean, so this is also
  // what keeps the two fetch paths measuring the same thing.
  it('averages the features that share a column', async () => {
    const rows = await run({
      features: [
        feat('a', 0, 1, 2),
        feat('a', 5, 6, 4),
        feat('a', 9, 10, 6),
        feat('a', 10, 20, 100),
      ],
      regions: [region('chr1', 0, 20)],
      sources: ['a'],
      bpPerPx: 10,
    })
    expect(Array.from(rows.get('a')!)).toEqual([4, 100])
  })
})

// MultiWiggleAdapter: real per-subtrack files, so the matrix takes the same
// typed-array fast path the render RPC does instead of re-fetching down the
// feature-object route.
describe('getScoreMatrix multi-source adapter', () => {
  function raws(...spans: [number, number, number][]) {
    return {
      starts: new Int32Array(spans.map(s => s[0])),
      ends: new Int32Array(spans.map(s => s[1])),
      scores: new Float32Array(spans.map(s => s[2])),
      minScores: undefined,
      maxScores: undefined,
      count: spans.length,
    }
  }

  it('asks for every region in one call and bins the arrays it gets back', async () => {
    const getMultiSourceFeatureArraysMulti = jest.fn().mockResolvedValue([
      { source: 'a', raws: [raws([0, 50, 1]), raws([0, 100, 2])] },
      { source: 'b', raws: [raws([25, 26, 8]), raws()] },
    ])
    jest
      .mocked(getFeatureAdapterOrThrow)
      .mockResolvedValue({ getMultiSourceFeatureArraysMulti } as never)

    const regions = [region('chr1', 0, 100), region('chr2', 0, 100)]
    const rows = await getScoreMatrix({
      pluginManager: pm,
      args: callArgs({ regions, sources: ['a', 'b'], bpPerPx: 50 }),
    })

    // one fan-out for the whole view, not one per region, and the source list
    // rides along so the adapter narrows to the subtracks being clustered
    expect(getMultiSourceFeatureArraysMulti).toHaveBeenCalledTimes(1)
    const [regionsArg, optsArg] =
      getMultiSourceFeatureArraysMulti.mock.calls[0]!
    expect(regionsArg).toEqual(regions)
    expect(optsArg.sources.map((s: { name: string }) => s.name)).toEqual([
      'a',
      'b',
    ])

    expect(Array.from(rows.get('a')!)).toEqual([1, 0, 2, 2])
    // sub-column feature in region 0 column 0, nothing in region 1
    expect(Array.from(rows.get('b')!)).toEqual([8, 0, 0, 0])
  })

  it('leaves a subtrack the adapter did not report an all-zero row', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getMultiSourceFeatureArraysMulti: jest
        .fn()
        .mockResolvedValue([{ source: 'a', raws: [raws([0, 100, 3])] }]),
    } as never)

    const rows = await getScoreMatrix({
      pluginManager: pm,
      args: callArgs({
        regions: [region('chr1', 0, 100)],
        sources: ['a', 'ghost'],
        bpPerPx: 50,
      }),
    })

    expect(Array.from(rows.get('a')!)).toEqual([3, 3])
    expect(Array.from(rows.get('ghost')!)).toEqual([0, 0])
  })
})

// The wrapping — the only line that assembles this method's transfer list — was
// reached by nothing here, and it could not have passed: `rpcResult`'s
// under-test check walks with `Object.entries`, blank on a Map, so it reported
// the (correct) list as entries "not in the payload". The report was waiting for
// the first caller who exercised `execute`.
describe('MultiWiggleGetScoreMatrix.execute', () => {
  it('transfers one buffer per row of the matrix', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getMultiSourceFeatureArraysMulti: jest.fn().mockResolvedValue([
        {
          source: 'a',
          raws: [
            {
              starts: new Int32Array([0]),
              ends: new Int32Array([100]),
              scores: new Float32Array([3]),
              minScores: undefined,
              maxScores: undefined,
              count: 1,
            },
          ],
        },
      ]),
    } as never)

    const result = await new MultiWiggleGetScoreMatrix(pm).execute(
      callArgs({
        regions: [region('chr1', 0, 100)],
        sources: ['a', 'b'],
        bpPerPx: 50,
      }),
    )

    const rows = unwrapRpcResult(result)
    expect([...rows.keys()]).toEqual(['a', 'b'])
    expect(result.transferables).toEqual([...rows.values()].map(r => r.buffer))
  })
})
