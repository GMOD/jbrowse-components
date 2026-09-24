import { resolveAssemblies } from './resolveAssemblies.ts'

jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

const volvox = { name: 'volvox', uri: 'volvox.2bit' }

const hub = {
  assemblies: [{ name: 'hg38', uri: 'hg38.2bit' }],
  tracks: [
    { trackId: 'genes', name: 'Hub genes' },
    { trackId: 'repeats', name: 'Hub repeats' },
  ],
  aggregateTextSearchAdapters: [
    { type: 'TrixTextSearchAdapter', uri: 'trix/hg38.ix' },
    { type: 'TrixTextSearchAdapter', uri: 'trix/hg38-extra.ix' },
  ],
}

test('an assembly with no hub and a host with nothing adds no keys a spread could clear', async () => {
  const options = { tracks: [{ trackId: 'mine' }] }
  const resolved = await resolveAssemblies([volvox])

  expect(Object.keys(resolved)).toEqual(['assemblies'])
  expect({ ...options, ...resolved }.tracks).toEqual([{ trackId: 'mine' }])
})

test("a hub's catalog and indexes come back merged with the host's, the host winning an id or a file", async () => {
  const mine = {
    type: 'TrixTextSearchAdapter',
    ixFilePath: { uri: 'trix/hg38-extra.ix' },
    assemblyNames: ['hg38'],
  }
  const resolved = await resolveAssemblies([hub], {
    tracks: [{ trackId: 'genes', name: 'My genes' }, { trackId: 'mine' }],
    aggregateTextSearchAdapters: [mine, { uri: 'mine.ix' }],
  })

  expect(resolved.tracks).toEqual([
    { trackId: 'repeats', name: 'Hub repeats' },
    { trackId: 'genes', name: 'My genes' },
    { trackId: 'mine' },
  ])
  expect(resolved.aggregateTextSearchAdapters).toEqual([
    {
      type: 'TrixTextSearchAdapter',
      uri: 'trix/hg38.ix',
      assemblyNames: ['hg38'],
    },
    mine,
    { uri: 'mine.ix' },
  ])
})

test("a hub's short index takes the hub's assembly before the merge, and the host's URL for the same file replaces it", async () => {
  const mm39 = {
    assemblies: [{ name: 'mm39', uri: 'mm39.2bit' }],
    aggregateTextSearchAdapters: [
      {
        uri: 'trix/mm39.ix',
        baseUri: 'https://jbrowse.org/ucsc/mm39/config.json',
      },
      'trix/mm39-extra.ix',
    ],
  }
  const hostIndex = 'https://jbrowse.org/ucsc/mm39/trix/mm39.ix'
  const resolved = await resolveAssemblies([hub, mm39], {
    aggregateTextSearchAdapters: [hostIndex],
  })

  expect(resolved.aggregateTextSearchAdapters).toEqual([
    {
      type: 'TrixTextSearchAdapter',
      uri: 'trix/hg38.ix',
      assemblyNames: ['hg38'],
    },
    {
      type: 'TrixTextSearchAdapter',
      uri: 'trix/hg38-extra.ix',
      assemblyNames: ['hg38'],
    },
    {
      type: 'TrixTextSearchAdapter',
      uri: 'trix/mm39-extra.ix',
      assemblyNames: ['mm39'],
    },
    hostIndex,
  ])
})
