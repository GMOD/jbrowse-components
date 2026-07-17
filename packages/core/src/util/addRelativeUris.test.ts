import { addRelativeUris, stripBaseUris } from './addRelativeUris.ts'

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
