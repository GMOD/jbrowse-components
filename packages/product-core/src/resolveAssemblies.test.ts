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
    { type: 'TrixTextSearchAdapter', uri: 'trix/hg38.ix' },
    mine,
    { uri: 'mine.ix' },
  ])
})
