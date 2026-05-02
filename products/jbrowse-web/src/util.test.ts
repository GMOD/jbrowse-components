import {
  addRelativeUris,
  b64PadSuffix,
  fromUrlSafeB64,
  removeAttr,
  toUrlSafeB64,
} from './util.ts'

describe('b64PadSuffix', () => {
  it('adds no padding when length % 4 === 0', () => {
    expect(b64PadSuffix('abcd')).toBe('abcd')
    expect(b64PadSuffix('abcdabcd')).toBe('abcdabcd')
  })

  it('adds one = when length % 4 === 3', () => {
    expect(b64PadSuffix('abc')).toBe('abc=')
    expect(b64PadSuffix('abcdefg')).toBe('abcdefg=')
  })

  it('adds two == when length % 4 === 2', () => {
    expect(b64PadSuffix('ab')).toBe('ab==')
    expect(b64PadSuffix('abcdab')).toBe('abcdab==')
  })

  it('throws for length % 4 === 1', () => {
    expect(() => b64PadSuffix('a')).toThrow('base64 not a valid length')
    expect(() => b64PadSuffix('abcda')).toThrow('base64 not a valid length')
  })
})

describe('toUrlSafeB64 / fromUrlSafeB64 roundtrip', () => {
  it('encodes and decodes a simple string', async () => {
    const input = 'hello world'
    const encoded = await toUrlSafeB64(input)
    expect(await fromUrlSafeB64(encoded)).toBe(input)
  })

  it('encodes and decodes JSON', async () => {
    const input = JSON.stringify({
      id: 'abc',
      views: [{ type: 'LinearGenomeView' }],
    })
    const encoded = await toUrlSafeB64(input)
    expect(await fromUrlSafeB64(encoded)).toBe(input)
  })

  it('produces URL-safe output (no + or / or =)', async () => {
    const encoded = await toUrlSafeB64('test data for encoding')
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('addRelativeUris', () => {
  it('adds baseUri to uri fields', () => {
    const base = new URL('https://example.com/config/')
    const config: Record<string, unknown> = { uri: 'data.bam' }
    addRelativeUris(config, base)
    expect(config.baseUri).toBe('https://example.com/config/')
  })

  it('does not override existing baseUri', () => {
    const base = new URL('https://example.com/config/')
    const config: Record<string, unknown> = {
      uri: 'data.bam',
      baseUri: 'https://other.com/',
    }
    addRelativeUris(config, base)
    expect(config.baseUri).toBe('https://other.com/')
  })

  it('recurses into nested objects', () => {
    const base = new URL('https://example.com/')
    const config: Record<string, unknown> = {
      adapter: { uri: 'data.bam' },
    }
    addRelativeUris(config, base)
    expect((config.adapter as Record<string, unknown>).baseUri).toBe(
      'https://example.com/',
    )
  })

  it('handles null input gracefully', () => {
    const base = new URL('https://example.com/')
    expect(() => {
      addRelativeUris(null, base)
    }).not.toThrow()
  })
})

describe('removeAttr', () => {
  it('removes the specified attribute at the top level', () => {
    const obj = { a: 1, baseUri: 'https://example.com/', b: 2 }
    const result = removeAttr(obj, 'baseUri')
    expect(result).not.toHaveProperty('baseUri')
    expect(result.a).toBe(1)
  })

  it('removes the attribute recursively', () => {
    const obj = { nested: { baseUri: 'https://example.com/', value: 42 } }
    removeAttr(obj, 'baseUri')
    expect((obj.nested as Record<string, unknown>).baseUri).toBeUndefined()
    expect((obj.nested as Record<string, unknown>).value).toBe(42)
  })

  it('returns the modified object', () => {
    const obj = { x: 1 }
    expect(removeAttr(obj, 'missing')).toBe(obj)
  })
})
