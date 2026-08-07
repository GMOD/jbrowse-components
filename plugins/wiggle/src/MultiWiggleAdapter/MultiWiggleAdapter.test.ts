import { SimpleFeature } from '@jbrowse/core/util'
import { of } from 'rxjs'

import MultiWiggleAdapter from './MultiWiggleAdapter.ts'
import configSchema from './configSchema.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, StatusCallback } from '@jbrowse/core/util'

// getSources strips dataAdapter before returning — these tests only exercise
// metadata flow, never call into dataAdapter. One named stub avoids per-call
// casts.
const stubDataAdapter = {} as BaseFeatureDataAdapter

describe('MultiWiggleAdapter.getAdapters with bigWigs config', () => {
  it('derives source names from URI filenames', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        bigWigs: [
          'https://example.com/path/sample.bw',
          'https://example.com/path/track.bigwig',
        ],
      }),
      mockGetSubAdapter,
    )
    const adapters = await adapter.getAdapters()
    expect(adapters[0]!.source).toBe('sample')
    expect(adapters[1]!.source).toBe('track')
  })

  it('does not strip the last char from filenames with no extension', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({ bigWigs: ['https://example.com/data/noext'] }),
      mockGetSubAdapter,
    )
    const adapters = await adapter.getAdapters()
    expect(adapters[0]!.source).toBe('noext')
  })

  it('disambiguates same-basename files in different directories (#5598)', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        bigWigs: [
          'https://example.com/cond1/sample.bw',
          'https://example.com/cond2/sample.bw',
        ],
      }),
      mockGetSubAdapter,
    )
    const adapters = await adapter.getAdapters()
    expect(adapters[0]!.source).toBe('cond1/sample')
    expect(adapters[1]!.source).toBe('cond2/sample')
  })

  it('falls back to a numeric suffix when paths do not disambiguate', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        subadapters: [
          {
            type: 'BigWigAdapter',
            source: 'dup',
            bigWigLocation: { uri: 'a' },
          },
          {
            type: 'BigWigAdapter',
            source: 'dup',
            bigWigLocation: { uri: 'b' },
          },
          {
            type: 'BigWigAdapter',
            source: 'dup',
            bigWigLocation: { uri: 'c' },
          },
        ],
      }),
      mockGetSubAdapter,
    )
    const adapters = await adapter.getAdapters()
    expect(adapters.map(a => a.source)).toEqual(['dup', 'dup (2)', 'dup (3)'])
  })

  it('handles filenames with multiple dots', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        bigWigs: ['https://example.com/data/sample.data.bw'],
      }),
      mockGetSubAdapter,
    )
    const adapters = await adapter.getAdapters()
    expect(adapters[0]!.source).toBe('sample.data')
  })

  // The memo is what keeps every fetch, stats call and clustering run on a
  // track from rebuilding the subadapters; caching the rejection too meant one
  // failing subadapter permanently broke the track, with no way back short of
  // recreating it.
  it('does not cache a failed subadapter build', async () => {
    const mockGetSubAdapter = jest
      .fn()
      .mockRejectedValueOnce(new Error('adapter type not registered yet'))
      .mockImplementation(async (conf: { source?: string }) => ({
        dataAdapter: { id: conf.source ?? 'mock' },
      }))
    const adapter = new MultiWiggleAdapter(
      configSchema.create({ bigWigs: ['https://example.com/path/sample.bw'] }),
      mockGetSubAdapter,
    )
    await expect(adapter.getAdapters()).rejects.toThrow(
      'adapter type not registered yet',
    )
    const adapters = await adapter.getAdapters()
    expect(adapters[0]!.source).toBe('sample')
  })
})

describe('MultiWiggleAdapter.getSources', () => {
  let adapter: MultiWiggleAdapter

  describe('with subadapters using URI locations', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              name: 'test-data-1',
              bigWigLocation: {
                uri: 'https://example.com/data/sample1.bw',
              },
            },
            {
              type: 'BigWigAdapter',
              name: 'test-data-2',
              bigWigLocation: {
                uri: 'https://example.com/data/sample2.bw',
              },
            },
          ],
        }),
      )

      // Mock getAdapters
      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'source-1',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/data/sample1.bw',
          },
          dataAdapter: stubDataAdapter,
        },
        {
          source: 'source-2',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/data/sample2.bw',
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should return sources with name equal to source', async () => {
      const sources = await adapter.getSources([
        {
          refName: 'chr1',
          start: 0,
          end: 100000,
          assemblyName: 'hg38',
        },
      ])

      expect(sources).toHaveLength(2)
      expect(sources[0]!).toMatchObject({
        name: 'source-1',
        source: 'source-1',
      })
      expect(sources[1]!).toMatchObject({
        name: 'source-2',
        source: 'source-2',
      })
    })
  })

  describe('with subadapters using localPath', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                localPath: '/home/user/data/file1.bw',
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'file1-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            localPath: '/home/user/data/file1.bw',
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should return name equal to source', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'file1-source',
        source: 'file1-source',
      })
    })
  })

  describe('with subadapters using blob', () => {
    beforeEach(() => {
      const mockFile = new File(['data'], 'sample-blob.bw')

      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                blob: mockFile,
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'blob-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            blob: mockFile,
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should return name equal to source', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'blob-source',
        source: 'blob-source',
      })
    })
  })

  describe('with fallback to name property', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              name: 'provided-name',
              bigWigLocation: {
                uri: 'https://example.com/data/sample.bw',
              },
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'auto-source',
          name: 'provided-name',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/data/sample.bw',
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should return name equal to source', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'auto-source',
        source: 'auto-source',
      })
    })
  })

  describe('with fallback to source property', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'fallback-source',
          type: 'OtherAdapter',
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should use source when name and filename extraction fail', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'fallback-source',
        source: 'fallback-source',
      })
    })
  })

  describe('with empty array', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([])
    })

    it('should return empty array when no adapters', async () => {
      const sources = await adapter.getSources([])

      expect(sources).toEqual([])
    })
  })

  describe('with additional properties', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(
        configSchema.create({
          subadapters: [
            {
              type: 'BigWigAdapter',
              bigWigLocation: {
                uri: 'https://example.com/data/test.bw',
              },
              customProp: 'custom-value',
              anotherProp: 42,
            },
          ],
        }),
      )

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/data/test.bw',
          },
          customProp: 'custom-value',
          anotherProp: 42,
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should preserve custom properties in returned sources', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'test-source',
        source: 'test-source',
        customProp: 'custom-value',
        anotherProp: 42,
      })
    })

    it('should exclude dataAdapter from returned sources', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).not.toHaveProperty('dataAdapter')
    })
  })

  describe('with complex URIs', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test1',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/path/to/deep/nested/sample.bw',
          },
          dataAdapter: stubDataAdapter,
        },
        {
          source: 'test2',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'file:///local/path/file.with.dots.bw',
          },
          dataAdapter: stubDataAdapter,
        },
        {
          source: 'test3',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://s3.amazonaws.com/bucket/key/data.no-extension',
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should return name equal to source', async () => {
      const sources = await adapter.getSources([])

      expect(sources[0]!).toMatchObject({
        name: 'test1',
        source: 'test1',
      })
      expect(sources[1]!).toMatchObject({
        name: 'test2',
        source: 'test2',
      })
      expect(sources[2]!).toMatchObject({
        name: 'test3',
        source: 'test3',
      })
    })
  })

  describe('regions parameter handling', () => {
    beforeEach(() => {
      adapter = new MultiWiggleAdapter(configSchema.create({}))

      adapter.getAdapters = jest.fn().mockResolvedValue([
        {
          source: 'test-source',
          type: 'BigWigAdapter',
          bigWigLocation: {
            uri: 'https://example.com/data/test.bw',
          },
          dataAdapter: stubDataAdapter,
        },
      ])
    })

    it('should ignore regions parameter and return same sources', async () => {
      const regions1 = [
        { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' },
      ]
      const regions2 = [
        { refName: 'chr2', start: 5000, end: 10000, assemblyName: 'hg38' },
      ]

      const sources1 = await adapter.getSources(regions1)
      const sources2 = await adapter.getSources(regions2)

      expect(sources1).toEqual(sources2)
    })
  })
})

describe('MultiWiggleAdapter.getMultiSourceFeatureArraysMulti', () => {
  const region = { refName: 'chr1', start: 0, end: 100, assemblyName: 'hg38' }
  const region2 = {
    refName: 'chr1',
    start: 500,
    end: 600,
    assemblyName: 'hg38',
  }

  function makeRaw(score: number) {
    return {
      starts: new Int32Array([10]),
      ends: new Int32Array([20]),
      scores: new Float32Array([score]),
      minScores: undefined,
      maxScores: undefined,
      count: 1,
    }
  }

  function makeAdapter(inner: Record<string, unknown>, sources = ['a', 'b']) {
    const mockGetSubAdapter = jest.fn().mockImplementation(
      async (conf: { source?: string }) =>
        ({
          dataAdapter: { id: conf.source ?? 'mock', ...inner },
        }) as any,
    )
    return new MultiWiggleAdapter(
      configSchema.create({
        subadapters: sources.map(source => ({
          type: 'BigWigAdapter',
          source,
          bigWigLocation: { uri: `${source}.bw` },
        })),
      }),
      mockGetSubAdapter,
    )
  }

  // The point of the batch: a subadapter that can serve every region in one
  // pass (BigWig coalesces adjacent on-disk blocks across region boundaries)
  // gets called ONCE with all of them, not once per region.
  it('hands all regions to a subadapter that exposes getFeatureArraysMulti', async () => {
    const multi = jest.fn().mockResolvedValue([makeRaw(1), makeRaw(2)])
    const adapter = makeAdapter({ getFeatureArraysMulti: multi }, ['a'])
    const result = await adapter.getMultiSourceFeatureArraysMulti(
      [region, region2],
      { bpPerPx: 1, resolution: 1 },
    )
    expect(multi).toHaveBeenCalledTimes(1)
    expect(multi.mock.calls[0]![0]).toEqual([region, region2])
    expect(result).toHaveLength(1)
    expect(result[0]!.source).toBe('a')
    expect(result[0]!.raws.map(r => r.scores[0])).toEqual([1, 2])
  })

  it('falls back to one getFeatureArrays call per region', async () => {
    const fastA = jest.fn().mockResolvedValue(makeRaw(1))
    const fastB = jest.fn().mockResolvedValue(makeRaw(2))
    const mockGetSubAdapter = jest.fn().mockImplementation(
      async (conf: { source?: string }) =>
        ({
          dataAdapter: {
            id: conf.source ?? 'mock',
            getFeatureArrays: conf.source === 'a' ? fastA : fastB,
          },
        }) as any,
    )
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        subadapters: [
          {
            type: 'BigWigAdapter',
            source: 'a',
            bigWigLocation: { uri: 'a.bw' },
          },
          {
            type: 'BigWigAdapter',
            source: 'b',
            bigWigLocation: { uri: 'b.bw' },
          },
        ],
      }),
      mockGetSubAdapter,
    )
    const result = await adapter.getMultiSourceFeatureArraysMulti(
      [region, region2],
      { bpPerPx: 1, resolution: 1 },
    )
    expect(fastA).toHaveBeenCalledTimes(2)
    expect(fastB).toHaveBeenCalledTimes(2)
    expect(result.map(r => r.source)).toEqual(['a', 'b'])
    expect(result[0]!.raws).toHaveLength(2)
    expect(result[0]!.raws[0]!.scores[0]).toBe(1)
    expect(result[1]!.raws[1]!.scores[0]).toBe(2)
  })

  it('falls back to getFeaturesArray+featuresToRaw when neither array method exists', async () => {
    const getFeaturesArray = jest
      .fn()
      .mockResolvedValue([
        { get: (k: string) => ({ start: 5, end: 15, score: 7 })[k] },
      ])
    const adapter = makeAdapter({ getFeaturesArray }, ['slow'])
    const result = await adapter.getMultiSourceFeatureArraysMulti([region], {
      bpPerPx: 1,
      resolution: 1,
    })
    expect(getFeaturesArray).toHaveBeenCalledTimes(1)
    expect(result[0]!.source).toBe('slow')
    expect(result[0]!.raws[0]!.scores[0]).toBe(7)
  })

  it('filters inner adapters by opts.sources', async () => {
    const fastA = jest.fn().mockResolvedValue(makeRaw(1))
    const fastB = jest.fn().mockResolvedValue(makeRaw(2))
    const mockGetSubAdapter = jest.fn().mockImplementation(
      async (conf: { source?: string }) =>
        ({
          dataAdapter: {
            id: conf.source,
            getFeatureArrays: conf.source === 'a' ? fastA : fastB,
          },
        }) as any,
    )
    const adapter = new MultiWiggleAdapter(
      configSchema.create({
        subadapters: [
          {
            type: 'BigWigAdapter',
            source: 'a',
            bigWigLocation: { uri: 'a.bw' },
          },
          {
            type: 'BigWigAdapter',
            source: 'b',
            bigWigLocation: { uri: 'b.bw' },
          },
        ],
      }),
      mockGetSubAdapter,
    )
    const result = await adapter.getMultiSourceFeatureArraysMulti([region], {
      bpPerPx: 1,
      resolution: 1,
      sources: [{ name: 'b' }],
    })
    expect(fastA).not.toHaveBeenCalled()
    expect(fastB).toHaveBeenCalledTimes(1)
    expect(result.map(r => r.source)).toEqual(['b'])
  })

  // 40 bigwigs downloading at once share one status field: unslotted, the last
  // writer won and the first file to finish blanked the label while the rest
  // were still going, so a multiwiggle showed no determinate progress at all.
  it('gives each subtrack its own status slot so progress aggregates', async () => {
    const slots: StatusCallback[] = []
    const fast = jest
      .fn()
      .mockImplementation(
        (_region: unknown, opts: { statusCallback?: StatusCallback }) => {
          slots.push(opts.statusCallback!)
          return Promise.resolve(makeRaw(1))
        },
      )
    const adapter = makeAdapter({ getFeatureArrays: fast }, ['a', 'b'])

    const seen: unknown[] = []
    await adapter.getMultiSourceFeatureArraysMulti([region], {
      bpPerPx: 1,
      resolution: 1,
      statusCallback: s => {
        seen.push(s)
      },
    })

    expect(slots).toHaveLength(2)
    expect(slots[0]).not.toBe(slots[1])

    seen.length = 0
    slots[0]!({ message: 'Downloading wiggle data', current: 5, total: 50 })
    slots[1]!({ message: 'Downloading wiggle data', current: 20, total: 40 })
    expect(seen.at(-1)).toEqual({
      message: 'Downloading wiggle data',
      current: 25,
      total: 90,
    })
  })

  it('returns raw arrays unchanged — bicolor split happens at the executor', async () => {
    const fast = jest.fn().mockResolvedValue({
      starts: new Int32Array([0, 10]),
      ends: new Int32Array([5, 15]),
      scores: new Float32Array([3, -2]),
      minScores: undefined,
      maxScores: undefined,
      count: 2,
    })
    const adapter = makeAdapter({ getFeatureArrays: fast }, ['a'])
    const result = await adapter.getMultiSourceFeatureArraysMulti([region], {
      bpPerPx: 1,
      resolution: 1,
    })
    expect(result[0]!.raws[0]!.count).toBe(2)
    expect(Array.from(result[0]!.raws[0]!.scores)).toEqual([3, -2])
  })
})

// disambiguateSources renames a colliding entry AFTER its subadapter was built
// from the original config, so the subadapter keeps stamping the pre-rename
// `source` on every feature it emits. getFeatures has to correct that: the
// score-matrix clustering groups on feature.get('source') while keying its rows
// off the disambiguated names, so both rows came back empty (#5598 follow-up).
describe('MultiWiggleAdapter.getFeatures source stamping', () => {
  const region = {
    refName: 'chr1',
    start: 0,
    end: 100,
    assemblyName: 'hg38',
  }

  function collect(adapter: MultiWiggleAdapter) {
    return new Promise<Feature[]>((resolve, reject) => {
      const out: Feature[] = []
      adapter.getFeatures(region).subscribe({
        next: f => out.push(f),
        error: reject,
        complete: () => {
          resolve(out)
        },
      })
    })
  }

  // both files are `sample.bw`, so disambiguateSources grows them to
  // cond1/sample and cond2/sample while each BigWigAdapter still says 'sample'
  function makeAdapter(emittedSource: string | undefined) {
    const mockGetSubAdapter = jest.fn().mockImplementation(
      async (conf: { source?: string }) =>
        ({
          dataAdapter: {
            id: conf.source ?? 'mock',
            getFeatures: () =>
              of(
                new SimpleFeature({
                  uniqueId: 'f1',
                  refName: 'chr1',
                  start: 0,
                  end: 10,
                  score: 1,
                  ...(emittedSource === undefined
                    ? {}
                    : { source: emittedSource }),
                }),
              ),
          },
        }) as any,
    )
    return new MultiWiggleAdapter(
      configSchema.create({
        bigWigs: [
          'https://example.com/cond1/sample.bw',
          'https://example.com/cond2/sample.bw',
        ],
      }),
      mockGetSubAdapter,
    )
  }

  it('restamps features carrying the pre-disambiguation source', async () => {
    const feats = await collect(makeAdapter('sample'))
    expect(feats.map(f => f.get('source'))).toEqual([
      'cond1/sample',
      'cond2/sample',
    ])
    // uniqueIds must diverge too, or the two subtracks collide downstream
    expect(new Set(feats.map(f => f.id())).size).toBe(2)
  })

  it('still stamps adapters that set no source at all', async () => {
    const feats = await collect(makeAdapter(undefined))
    expect(feats.map(f => f.get('source'))).toEqual([
      'cond1/sample',
      'cond2/sample',
    ])
  })

  it('passes an already-correct feature through untouched', async () => {
    const adapter = makeAdapter('cond1/sample')
    const feats = await collect(adapter)
    // the cond1 subadapter's feature needs no wrapping, so it keeps its own id
    expect(feats.find(f => f.get('source') === 'cond1/sample')!.id()).toBe('f1')
  })
})
