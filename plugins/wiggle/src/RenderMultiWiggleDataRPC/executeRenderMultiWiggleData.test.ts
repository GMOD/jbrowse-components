import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import { executeRenderMultiWiggleData } from './executeRenderMultiWiggleData.ts'

import type { RawFeatureArrays } from '../util.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

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
  statusCallback?: StatusCallback
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

  // A plain bedGraph pointed at a MultiQuantitativeTrack has no source column,
  // so every feature comes back with `source: undefined`. Grouping used to
  // stringify that into a subtrack literally named "undefined", which reached
  // the tooltip as `undefined: 5`.
  it('names a source-less feature group with the empty string, not "undefined"', async () => {
    const anon = (start: number, score: number) =>
      new SimpleFeature({
        uniqueId: `anon-${start}`,
        refName: 'chr1',
        start,
        end: start + 10,
        score,
      })
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getFeaturesArray: jest.fn().mockResolvedValue([anon(0, 5), anon(10, 6)]),
    } as never)

    const results = await run({})

    expect(results[0]!.sources.map(s => s.name)).toEqual([''])
    expect(scoresOf(results[0]!, '')).toEqual([5, 6])
  })

  // The regions download at once through one status field, so each gets its own
  // fan-out slot: unslotted, the last writer won and the first region to finish
  // blanked the label while the rest were still downloading.
  it('aggregates concurrent per-region download progress into one bar', async () => {
    const slots: StatusCallback[] = []
    const getFeaturesArray = jest
      .fn()
      .mockImplementation(
        (_region: unknown, opts: { statusCallback?: StatusCallback }) => {
          slots.push(opts.statusCallback!)
          return Promise.resolve([])
        },
      )
    jest
      .mocked(getFeatureAdapterOrThrow)
      .mockResolvedValue({ getFeaturesArray } as never)

    const seen: unknown[] = []
    await run({
      statusCallback: s => {
        seen.push(s)
      },
    })

    // both regions were handed a callback, and not the same one
    expect(slots).toHaveLength(2)
    expect(slots[0]).not.toBe(slots[1])

    seen.length = 0
    slots[0]!({ message: 'Downloading wiggle data', current: 10, total: 100 })
    slots[1]!({ message: 'Downloading wiggle data', current: 30, total: 200 })
    // summed, not last-writer-wins
    expect(seen.at(-1)).toEqual({
      message: 'Downloading wiggle data',
      current: 40,
      total: 300,
    })
  })

  // Source names come out of a file's column, so they can be anything. Both of
  // these are why the grouping is a Map rather than a plain object: integer-like
  // keys hoist ahead of the rest in one, and Object.prototype members read back
  // as inherited functions.
  it('discovers numeric-looking sources in file order, not numeric order', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getFeaturesArray: jest
        .fn()
        .mockResolvedValue([
          feature('10', 0, 1),
          feature('2', 10, 2),
          feature('1', 20, 3),
        ]),
    } as never)

    const results = await run({})

    expect(results[0]!.sources.map(s => s.name)).toEqual(['10', '2', '1'])
    expect(scoresOf(results[0]!, '10')).toEqual([1])
  })

  it('handles a source named after an Object.prototype member', async () => {
    jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
      getFeaturesArray: jest
        .fn()
        .mockResolvedValue([feature('constructor', 0, 7)]),
    } as never)

    const results = await run({})

    expect(results[0]!.sources.map(s => s.name)).toEqual(['constructor'])
    expect(scoresOf(results[0]!, 'constructor')).toEqual([7])
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
