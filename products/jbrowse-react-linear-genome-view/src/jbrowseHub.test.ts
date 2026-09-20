import { readConfObject } from '@jbrowse/core/configuration'
import { fetchHub } from '@jbrowse/core/util/fetchHub'

import createViewState, { createViewStateAsync } from './createViewState.ts'
import { destroyViewState } from './destroyViewState.ts'

jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

function featureTrack(trackId: string, name = trackId) {
  return {
    type: 'FeatureTrack',
    trackId,
    name,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  }
}

const hub = {
  assemblies: [
    {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
  ],
  tracks: [featureTrack('hub_genes'), featureTrack('shared', 'the hub copy')],
  aggregateTextSearchAdapters: [
    {
      type: 'TrixTextSearchAdapter',
      textSearchAdapterId: 'hub_index',
      assemblyNames: ['volvox'],
      ixFilePath: { uri: 'https://example.com/volvox.ix' },
      ixxFilePath: { uri: 'https://example.com/volvox.ixx' },
      metaFilePath: { uri: 'https://example.com/volvox_meta.json' },
    },
  ],
}

test("jbrowseHub brings the hub's assembly, catalog and search index, and the host's tracks win on a shared id", async () => {
  jest.mocked(fetchHub).mockResolvedValue(hub)
  const state = await createViewStateAsync({
    jbrowseHub: 'volvox',
    tracks: [featureTrack('mine'), featureTrack('shared', 'the host copy')],
    view: { loc: 'ctgA:1..100', tracks: ['hub_genes', 'mine'] },
  })
  try {
    expect(fetchHub).toHaveBeenCalledWith('volvox')
    const { session } = state
    expect(session.assemblyNames).toEqual(['volvox'])
    expect(session.tracks.map(t => readConfObject(t, 'trackId'))).toEqual([
      'hub_genes',
      'mine',
      'shared',
    ])
    expect(readConfObject(session.getTrackById('shared')!, 'name')).toBe(
      'the host copy',
    )
    expect(session.view.pendingLaunch).toMatchObject({
      assembly: 'volvox',
      tracks: ['hub_genes', 'mine'],
    })
    expect(
      state.config.aggregateTextSearchAdapters.map(
        (a: { textSearchAdapterId: string }) => a.textSearchAdapterId,
      ),
    ).toEqual(['hub_index'])
  } finally {
    destroyViewState(state)
  }
})

test('an assembly config asks no hub', async () => {
  jest.mocked(fetchHub).mockClear()
  const state = await createViewStateAsync({
    assembly: hub.assemblies[0]!,
  })
  try {
    expect(fetchHub).not.toHaveBeenCalled()
  } finally {
    destroyViewState(state)
  }
})

test('the synchronous creator names the two that can fetch', () => {
  expect(() =>
    // @ts-expect-error the synchronous options have no jbrowseHub
    createViewState({ jbrowseHub: 'hg38' }),
  ).toThrow(/useCreateViewState or createViewStateAsync/)
})

test('an assembly beside a jbrowseHub is refused', async () => {
  const both = { jbrowseHub: 'hg38', assembly: hub.assemblies[0]! }
  await expect(
    // @ts-expect-error a hub is a whole genome, so it excludes `assembly`
    createViewStateAsync(both),
  ).rejects.toThrow('pass assembly or jbrowseHub, not both')
})
