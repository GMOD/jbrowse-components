import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { createBaseTrackConfig } from '../pluggableElementTypes/models/index.ts'
import { isAbortException } from '../util/aborting.ts'
import BaseResult from './BaseResults.ts'
import TextSearchManager from './TextSearchManager.ts'

import type { BaseTextSearchAdapter } from '../data_adapters/BaseAdapter/index.ts'

const manager = new TextSearchManager({} as never)

// a loaded index whose adapter exposes only the surface search() calls
function fakeAdapter(
  searchIndex: () => Promise<BaseResult[]>,
  trackId?: string,
) {
  return {
    adapter: { searchIndex } as unknown as BaseTextSearchAdapter,
    trackId,
  }
}

const sort = async (labels: string[], queryString: string) =>
  (
    await manager.sortResults({
      results: labels.map(label => new BaseResult({ label })),
      args: { queryString },
    })
  ).map(r => r.getLabel())

describe('sortResults', () => {
  it('floats display-string matches to the top', async () => {
    expect(await sort(['other', 'BRCA1', 'BRCA1 pseudogene'], 'BRCA1')).toEqual(
      ['BRCA1', 'BRCA1 pseudogene', 'other'],
    )
  })

  it('keeps hits whose match lives outside the display string', async () => {
    // regression: TrixTextSearchAdapter accepts "eden splice" by scanning every
    // indexed attribute, but the display string is just "EDEN.1" — the fuzzy
    // pass used to filter those away, so multi-word search returned nothing
    expect(await sort(['EDEN.1', 'EDEN.2'], 'eden splice')).toEqual([
      'EDEN.1',
      'EDEN.2',
    ])
  })

  it('keeps results for a query with no alphanumeric characters', async () => {
    expect(await sort(['a', 'b'], '...')).toEqual(['a', 'b'])
  })

  it('returns nothing for no results', async () => {
    expect(await sort([], 'anything')).toEqual([])
  })
})

describe('search resilience', () => {
  it('keeps healthy adapters results when another one fails', async () => {
    // a 404 .ix used to reject the whole Promise.all, which also threw away the
    // refName results fetchResults merges in afterwards, so a single broken
    // index made even "type chr1 and hit enter" fail
    const m = new TextSearchManager({} as never)
    m.loadTextSearchAdapters = async () => ({
      values: [
        fakeAdapter(() => Promise.reject(new Error('404 out.ix'))),
        fakeAdapter(async () => [new BaseResult({ label: 'BRCA1' })]),
      ],
      failures: [],
    })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const results = await m.search({ queryString: 'BRCA1' }, 'hg38')

    expect(results.map(r => r.getLabel())).toEqual(['BRCA1'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('reports what failed and how many indexes it asked', async () => {
    const m = new TextSearchManager({} as never)
    const notLoaded = new Error('no ixFilePath')
    const notFound = new Error('404 out.ix')
    m.loadTextSearchAdapters = async () => ({
      values: [
        fakeAdapter(() => Promise.reject(notFound)),
        fakeAdapter(async () => []),
      ],
      failures: [notLoaded],
    })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const report = await m.searchIndexes({ queryString: 'BRCA1' }, 'hg38')

    expect(report).toEqual({
      results: [],
      indexCount: 3,
      failures: [notLoaded, notFound],
    })
    spy.mockRestore()
  })

  it('drops a superseded query before ranking it', async () => {
    // every keystroke supersedes the previous one, and the ranking is the
    // expensive half (a dynamic import plus a fuzzy sort over every hit)
    const m = new TextSearchManager({} as never)
    m.loadTextSearchAdapters = async () => ({
      values: [fakeAdapter(async () => [new BaseResult({ label: 'BRCA1' })])],
      failures: [],
    })
    const sortSpy = jest.spyOn(m, 'sortResults')
    const signalController = new AbortController()
    const signal = signalController.signal
    signalController.abort()

    const thrown = await m
      .search({ queryString: 'BRCA1', signal }, 'hg38')
      .catch((e: unknown) => e)

    expect(isAbortException(thrown)).toBe(true)
    expect(sortSpy).not.toHaveBeenCalled()
  })

  it('still ranks a query whose signal is not aborted', async () => {
    const m = new TextSearchManager({} as never)
    m.loadTextSearchAdapters = async () => ({
      values: [fakeAdapter(async () => [new BaseResult({ label: 'BRCA1' })])],
      failures: [],
    })
    const results = await m.search(
      { queryString: 'BRCA1', signal: new AbortController().signal },
      'hg38',
    )
    expect(results.map(r => r.getLabel())).toEqual(['BRCA1'])
  })

  // a UCSC hub's index holds feature names only, so the hit would otherwise
  // open no track and show none in the picker
  it('a per-track index answers for its track when its hits name none', async () => {
    const m = new TextSearchManager({} as never)
    m.loadTextSearchAdapters = async () => ({
      values: [
        fakeAdapter(
          async () => [
            new BaseResult({ label: 'BRCA1' }),
            new BaseResult({ label: 'BRCA2', trackId: 'named' }),
          ],
          'genes',
        ),
      ],
      failures: [],
    })
    const results = await m.search({ queryString: 'BRCA' }, 'hg38')
    expect(results.map(r => [r.getLabel(), r.getTrackId()])).toEqual([
      ['BRCA1', 'genes'],
      ['BRCA2', 'named'],
    ])
  })
})

// A track's text index names whatever assembly the track it was built from
// named, while a search arrives under the name the session knows — so the two
// only meet through the aliases. Comparing them raw left an index unreachable
// from the very assembly it indexes.
describe('relevantAdapters', () => {
  // hg19 is an alias of the session's GRCh37
  const aliasing = {
    getCanonicalAssemblyName: (name: string) =>
      name === 'hg19' ? 'GRCh37' : name,
  }

  function managerWith(assemblyNames: string[], assemblyManager?: unknown) {
    return new TextSearchManager({
      rootModel: {
        jbrowse: {
          aggregateTextSearchAdapters: [
            {
              assemblyNames,
            },
          ],
        },
        session: { tracks: [], assemblyManager },
      },
    } as never)
  }

  it('finds an index that names an alias of the searched assembly', () => {
    expect(
      managerWith(['hg19'], aliasing).relevantAdapters('GRCh37'),
    ).toHaveLength(1)
    expect(
      managerWith(['GRCh37'], aliasing).relevantAdapters('hg19'),
    ).toHaveLength(1)
  })

  it('still rejects an index for a different assembly', () => {
    expect(managerWith(['mm10'], aliasing).relevantAdapters('GRCh37')).toEqual(
      [],
    )
  })

  it('falls back to the raw name with no session to resolve against', () => {
    expect(managerWith(['hg19']).relevantAdapters('hg19')).toHaveLength(1)
    expect(managerWith(['hg19']).relevantAdapters('GRCh37')).toEqual([])
  })
})

// getTrackAdaptersWithAssembly hydrates a frozen track conf
// (hydrateTrackConfig) before reading textSearching.textSearchAdapter, so this
// exercises the real schema-union resolution rather than a fake track shape —
// closest unit analogue of the desktop E2E regression this pins.
describe('getTrackAdaptersWithAssembly', () => {
  function pluginManagerWithFeatureTrack(
    sessionTracks: unknown[],
    connectionTracks: unknown[] = [],
  ) {
    const pluginManager = new PluginManager()
    pluginManager.addTextSearchAdapterType(
      () =>
        new TextSearchAdapterType({
          name: 'TrixTextSearchAdapter',
          configSchema: ConfigurationSchema(
            'TrixTextSearchAdapter',
            { uri: { type: 'string', defaultValue: '' } },
            { explicitlyTyped: true },
          ),
          getAdapterClass: () => Promise.reject(new Error('not instantiated')),
        }),
    )
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'FeatureTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'FeatureTrack',
        configSchema,
        stateModel: types.model('FeatureTrack', {}),
      })
    })
    pluginManager.createPluggableElements()
    pluginManager.configure()
    pluginManager.setRootModel({
      jbrowse: { aggregateTextSearchAdapters: [] },
      session: {
        tracks: sessionTracks,
        connectionInstances: [{ tracks: connectionTracks }],
      },
    } as never)
    return pluginManager
  }

  it('contributes nothing for a track with no search index', () => {
    const pluginManager = pluginManagerWithFeatureTrack([
      { trackId: 't1', type: 'FeatureTrack', assemblyNames: ['volvox'] },
    ])
    expect(
      new TextSearchManager(pluginManager).relevantAdapters('volvox'),
    ).toEqual([])
  })

  const indexedTrack = (trackId: string) => ({
    trackId,
    type: 'FeatureTrack',
    assemblyNames: ['volvox'],
    textSearching: {
      textSearchAdapter: {
        type: 'TrixTextSearchAdapter',
        uri: 'genes.ix',
        assemblyNames: ['volvox'],
      },
    },
  })

  it('finds a track that names its own search index', () => {
    const pluginManager = pluginManagerWithFeatureTrack([indexedTrack('t1')])
    expect(
      new TextSearchManager(pluginManager).relevantAdapters('volvox'),
    ).toHaveLength(1)
  })

  // a hub's tracks live on its connection, not in session.tracks
  it("finds a connection track's index and the track it belongs to", () => {
    const pluginManager = pluginManagerWithFeatureTrack(
      [indexedTrack('t1')],
      [indexedTrack('hub1')],
    )
    expect(
      new TextSearchManager(pluginManager)
        .relevantIndexes('volvox')
        .map(i => i.trackId),
    ).toEqual(['t1', 'hub1'])
  })
})
