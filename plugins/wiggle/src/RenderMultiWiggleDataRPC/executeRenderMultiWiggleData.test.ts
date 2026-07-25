import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeRenderMultiWiggleData } from './executeRenderMultiWiggleData.ts'

import type { RawFeatureArrays, WiggleDataResult } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')

const pm = {} as unknown as PluginManager

const regions: Region[] = [
  { refName: 'chr1', start: 0, end: 100, assemblyName: 'hg38' },
  { refName: 'chr2', start: 0, end: 100, assemblyName: 'hg38' },
]

function raw(scores: number[]): RawFeatureArrays {
  return {
    starts: new Int32Array(scores.map((_s, i) => i * 10)),
    ends: new Int32Array(scores.map((_s, i) => i * 10 + 5)),
    scores: new Float32Array(scores),
    minScores: undefined,
    maxScores: undefined,
    count: scores.length,
  }
}

function scoresOf(result: WiggleDataResult, name: string) {
  const source = result.sources.find(s => s.name === name)!
  return Array.from(source.featureScores)
}

async function run(args: {
  sources?: { name: string }[]
  bicolorPivot?: number
}) {
  // no cast: rpcResult carries its value type, so `value` arrives as the
  // WiggleDataResult[] the RpcRegistry declares for RenderMultiWiggleData
  const { value } = await executeRenderMultiWiggleData({
    pluginManager: pm,
    args: {
      sessionId: 'sid',
      adapterConfig: {},
      regions,
      ...args,
    },
  })
  return value
}

describe('multi-source adapter (batched)', () => {
  it('asks for every region in one call and keeps each source aligned to it', async () => {
    const getMultiSourceFeatureArraysMulti = jest.fn().mockResolvedValue([
      { source: 'a', raws: [raw([1, 2]), raw([3])] },
      { source: 'b', raws: [raw([-4]), raw([5])] },
    ])
    const getSources = jest
      .fn()
      .mockResolvedValue([{ name: 'a' }, { name: 'b' }])
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getMultiSourceFeatureArraysMulti,
      getSources,
    } as never)

    const results = await run({})

    // one fan-out for the whole view, not one per region
    expect(getMultiSourceFeatureArraysMulti).toHaveBeenCalledTimes(1)
    expect(getMultiSourceFeatureArraysMulti.mock.calls[0]![0]).toEqual(regions)
    expect(getSources).toHaveBeenCalledWith(regions)

    expect(results).toHaveLength(2)
    expect(scoresOf(results[0]!, 'a')).toEqual([1, 2])
    expect(scoresOf(results[0]!, 'b')).toEqual([-4])
    expect(scoresOf(results[1]!, 'a')).toEqual([3])
    expect(scoresOf(results[1]!, 'b')).toEqual([5])
  })

  it('gives a source absent from the payload an empty entry in every region', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getMultiSourceFeatureArraysMulti: jest
        .fn()
        .mockResolvedValue([{ source: 'a', raws: [raw([1]), raw([2])] }]),
      getSources: jest.fn(),
    } as never)

    // caller's list wins for a multi-source adapter, so 'ghost' must still be
    // present (with zero features) or row placement shifts between regions
    const results = await run({ sources: [{ name: 'a' }, { name: 'ghost' }] })

    expect(results.map(r => r.sources.map(s => s.name))).toEqual([
      ['a', 'ghost'],
      ['a', 'ghost'],
    ])
    expect(scoresOf(results[0]!, 'ghost')).toEqual([])
    expect(scoresOf(results[1]!, 'a')).toEqual([2])
  })

  it('splits pos/neg around bicolorPivot', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getMultiSourceFeatureArraysMulti: jest
        .fn()
        .mockResolvedValue([{ source: 'a', raws: [raw([3, -2]), raw([1])] }]),
      getSources: jest.fn().mockResolvedValue([{ name: 'a' }]),
    } as never)

    const results = await run({})
    const first = results[0]!.sources[0]!
    expect(first.posNumFeatures).toBe(1)
    expect(first.negNumFeatures).toBe(1)
  })
})

describe('plain feature adapter fallback', () => {
  function feature(source: string, start: number, score: number) {
    return new SimpleFeature({
      uniqueId: `${source}-${start}`,
      refName: 'chr1',
      start,
      end: start + 10,
      score,
      source,
    })
  }

  it('groups by source per region and unions sources across regions', async () => {
    const getFeaturesArray = jest
      .fn()
      // region 0 has only 'a'; 'b' first appears in region 1
      .mockResolvedValueOnce([feature('a', 0, 1)])
      .mockResolvedValueOnce([feature('a', 0, 2), feature('b', 10, 3)])
    jest
      .mocked(getFeatureAdapterOrThrow)
      .mockResolvedValue({ getFeaturesArray } as never)

    const results = await run({})

    expect(getFeaturesArray).toHaveBeenCalledTimes(2)
    // a source discovered late still lands in every region's list, empty where
    // it has no features — otherwise it stays invisible after navigation
    expect(results.map(r => r.sources.map(s => s.name))).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ])
    expect(scoresOf(results[0]!, 'a')).toEqual([1])
    expect(scoresOf(results[0]!, 'b')).toEqual([])
    expect(scoresOf(results[1]!, 'b')).toEqual([3])
  })

  it("keeps the caller's source order ahead of newly-discovered ones", async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getFeaturesArray: jest
        .fn()
        .mockResolvedValue([feature('z', 0, 1), feature('m', 10, 2)]),
    } as never)

    const results = await run({ sources: [{ name: 'm' }] })

    expect(results[0]!.sources.map(s => s.name)).toEqual(['m', 'z'])
  })
})
