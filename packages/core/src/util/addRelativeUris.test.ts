import {
  addRelativeUris,
  stripBaseUris,
  withPageBaseUri,
} from './addRelativeUris.ts'

test('addRelativeUris stamps baseUri next to a uri key', () => {
  const config: Record<string, unknown> = { uri: 'data.bam' }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://example.com/config/')
})

test('addRelativeUris recurses into nested objects and arrays', () => {
  const config: Record<string, unknown> = {
    adapter: { uri: 'data.bam' },
    tracks: [{ uri: 'a.bam' }, { uri: 'b.bam' }],
  }
  addRelativeUris(config, new URL('https://example.com/'))
  expect((config.adapter as Record<string, unknown>).baseUri).toBe(
    'https://example.com/',
  )
  expect(
    (config.tracks as Record<string, unknown>[]).map(t => t.baseUri),
  ).toEqual(['https://example.com/', 'https://example.com/'])
})

test('addRelativeUris stamps baseUri beside a bigWigs array of strings', () => {
  const adapter: Record<string, unknown> = { bigWigs: ['a.bw', 'b.bw'] }
  addRelativeUris({ adapter }, new URL('https://example.com/config/'))
  expect(adapter).toEqual({
    bigWigs: ['a.bw', 'b.bw'],
    baseUri: 'https://example.com/config/',
  })
})

test('an assembly file or a BED written as a bare string resolves against the config', () => {
  const base = 'https://example.com/data/config.json'
  const assembly = {
    name: 'hg38',
    refNameAliases: 'aliases.txt',
    cytobands: 'cytoBand.txt',
  }
  const adapter = {
    type: 'MCScanBlocksAdapter',
    bedLocations: ['a.bed', { uri: 'b.bed' }],
  }
  addRelativeUris({ assemblies: [assembly], adapter }, new URL(base))
  expect(assembly).toEqual({
    name: 'hg38',
    refNameAliases: { uri: 'aliases.txt', baseUri: base },
    cytobands: { uri: 'cytoBand.txt', baseUri: base },
  })
  expect(adapter.bedLocations).toEqual([
    { uri: 'a.bed', baseUri: base },
    { uri: 'b.bed', baseUri: base },
  ])
})

test('a search index written as a bare .ix string resolves against the config', () => {
  const track = { textSearching: { textSearchAdapter: 'trix/genes.ix' } }
  const config: Record<string, unknown> = {
    tracks: [track],
    aggregateTextSearchAdapters: ['trix/hg38.ix', { uri: 'trix/mm10.ix' }],
  }
  addRelativeUris(config, new URL('https://example.com/data/config.json'))
  const base = 'https://example.com/data/config.json'
  expect(track.textSearching.textSearchAdapter).toEqual({
    uri: 'trix/genes.ix',
    baseUri: base,
  })
  expect(config.aggregateTextSearchAdapters).toEqual([
    { uri: 'trix/hg38.ix', baseUri: base },
    { uri: 'trix/mm10.ix', baseUri: base },
  ])
})

// preserve-existing is the behavior that differed from the (now-deleted)
// data-management copy, which overwrote unconditionally
test('addRelativeUris preserves an existing baseUri', () => {
  const config: Record<string, unknown> = {
    uri: 'data.bam',
    baseUri: 'https://other.com/',
  }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://other.com/')
})

test('addRelativeUris tolerates null', () => {
  expect(() => {
    addRelativeUris(null, new URL('https://example.com/'))
  }).not.toThrow()
})

test('stripBaseUris deletes baseUri at every nesting level', () => {
  const config = {
    a: 1,
    baseUri: 'top',
    b: { baseUri: 'nested', c: 2, d: { baseUri: 'deep', e: 3 } },
    tracks: [{ uri: 'a.bam', baseUri: 'x' }],
  }
  expect(stripBaseUris(config)).toEqual({
    a: 1,
    b: { c: 2, d: { e: 3 } },
    tracks: [{ uri: 'a.bam' }],
  })
})

test('stripBaseUris round-trips addRelativeUris', () => {
  const config: Record<string, unknown> = {
    adapter: { uri: 'data.bam' },
    tracks: [{ uri: 'a.bam' }],
  }
  const original = structuredClone(config)
  addRelativeUris(config, new URL('https://example.com/'))
  expect(stripBaseUris(config)).toEqual(original)
})

test('stripBaseUris leaves null values intact and returns the input', () => {
  const obj = { a: null, baseUri: 'x' }
  expect(stripBaseUris(obj)).toBe(obj)
  expect(obj).toEqual({ a: null })
})

test('withPageBaseUri stamps a copy against the page, keeping an existing baseUri', () => {
  const config = {
    tracks: [{ uri: 'a.bam' }, { uri: 'b.bam', baseUri: 'https://hub.org/' }],
  }
  expect(withPageBaseUri(config)).toEqual({
    tracks: [
      { uri: 'a.bam', baseUri: document.baseURI },
      { uri: 'b.bam', baseUri: 'https://hub.org/' },
    ],
  })
  expect(config.tracks[0]).toEqual({ uri: 'a.bam' })
})
