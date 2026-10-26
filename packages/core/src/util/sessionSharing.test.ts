import { aesDecrypt, aesDecryptBytes } from './crypto.ts'
import {
  b64PadSuffix,
  encodeSessionParam,
  fromUrlSafeB64,
  readSessionFromDynamo,
  readSharedSession,
  sessionParamKind,
  sessionParamPayload,
  shareEndpoint,
  toUrlSafeB64,
} from './sessionSharing.ts'

import type * as CryptoModule from './crypto.ts'

jest.mock('./crypto.ts', () => ({
  ...jest.requireActual('./crypto.ts'),
  aesDecrypt: jest.fn().mockResolvedValue('decrypted-session-data'),
  aesEncrypt: jest.fn().mockResolvedValue('encrypted-data'),
}))

describe('shareEndpoint', () => {
  it('joins with one slash however the shareURL is configured', () => {
    expect(shareEndpoint('https://host/api/v1/', 'load')).toBe(
      'https://host/api/v1/load',
    )
    expect(shareEndpoint('https://host/api/v1', 'share')).toBe(
      'https://host/api/v1/share',
    )
  })

  it('leaves an empty shareURL relative to the page', () => {
    expect(shareEndpoint('', 'load')).toBe('load')
  })
})

describe('sessionParamKind / sessionParamPayload', () => {
  it.each([
    ['share-abc', 'share', 'abc'],
    ['encoded-eJy', 'encoded', 'eJy'],
    ['json-{"session":{}}', 'json', '{"session":{}}'],
    ['spec-{"views":[]}', 'spec', '{"views":[]}'],
    ['local-x-y', 'local', 'x-y'],
  ])('reads %s', (value, kind, payload) => {
    expect(sessionParamKind(value)).toBe(kind)
    expect(sessionParamPayload(value)).toBe(payload)
  })

  it('names no kind for an unprefixed value, and leaves it whole', () => {
    expect(sessionParamKind('sharex-abc')).toBeUndefined()
    expect(sessionParamPayload('sharex-abc')).toBe('sharex-abc')
  })
})

describe('encodeSessionParam short mode', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  // 96 bits: the share service hands the ciphertext to anyone with the id
  it('puts a fresh 16-character key after the id', async () => {
    fetchMock.mockResponse(JSON.stringify({ sessionId: 'id1' }))
    const share = async () =>
      (
        await encodeSessionParam(
          'short',
          {},
          { shareURL: 'https://s/', referer: '' },
        )
      ).sessionParam
    const [a, b] = await Promise.all([share(), share()])
    expect(a).toMatch(/^share-id1[\w-]{16}$/)
    expect(a).not.toBe(b)
  })
})

describe('readSharedSession', () => {
  const loadUrl = 'https://s/load'
  const session = { name: 'shared', views: [{ type: 'LinearGenomeView' }] }

  beforeEach(() => {
    fetchMock.resetMocks()
  })

  // Stands in for the share service: what `share` stores, `load` returns. One
  // that names its own id answers `id1`; one that takes offers answers the id
  // it was offered, and `load` finds the session only under that id.
  async function upload({ takesOffers = false } = {}) {
    let stored = ''
    let storedId = ''
    fetchMock.mockResponseOnce(async req => {
      const form = await req.formData()
      stored = form.get('session') as string
      storedId = takesOffers ? (form.get('sessionId') as string) : 'id1'
      return JSON.stringify({ sessionId: storedId })
    })
    const { sessionParam } = await encodeSessionParam('short', session, {
      shareURL: 'https://s/',
      referer: '',
    })
    fetchMock.mockResponseOnce(async req =>
      new URL(req.url).searchParams.get('sessionId') === storedId
        ? JSON.stringify({ session: stored })
        : JSON.stringify({}),
    )
    return { sessionParam, stored, storedId }
  }

  it('holds only the key when the service takes the offered id', async () => {
    const { sessionParam, storedId } = await upload({ takesOffers: true })
    const key = sessionParam.slice('share-'.length)

    expect(key).toMatch(/^[\w-]{16}$/)
    expect(JSON.parse(await readSharedSession(loadUrl, sessionParam))).toEqual(
      session,
    )
    // the service stores and serves the session under a hash of the key
    expect(storedId).not.toContain(key)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(key)
  })

  it('reads a link with its key after the id, sending only the id', async () => {
    const { sessionParam } = await upload()
    const key = sessionParam.slice(-16)

    expect(JSON.parse(await readSharedSession(loadUrl, sessionParam))).toEqual(
      session,
    )
    expect(fetchMock.mock.calls.at(-1)![0]).toBe(`${loadUrl}?sessionId=id1`)
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(key)
  })

  // an older link's blob held the deflated session as base64 text, a third
  // bigger for nothing
  it('stores the deflated bytes themselves, encrypted', async () => {
    const { sessionParam, stored } = await upload()
    const bytes = await aesDecryptBytes(stored, sessionParam.slice(-16))
    // a zlib stream's header byte, where base64 text would start with a letter
    expect(bytes[0]).toBe(0x78)
  })

  // every link shared before the key moved into the session value
  it('reads an older link, whose key is the password param', async () => {
    const actual: typeof CryptoModule = jest.requireActual('./crypto.ts')
    jest.mocked(aesDecrypt).mockImplementationOnce(actual.aesDecrypt)
    fetchMock.mockResponseOnce(
      JSON.stringify({
        session: await actual.aesEncrypt(
          await toUrlSafeB64(JSON.stringify(session)),
          'fYAbt',
        ),
      }),
    )

    expect(
      JSON.parse(await readSharedSession(loadUrl, 'share-old1', 'fYAbt')),
    ).toEqual(session)
  })

  it('says a link with no key has lost it, without fetching', async () => {
    await expect(readSharedSession(loadUrl, 'share-id1')).rejects.toThrow(
      /lost its key/,
    )
    await expect(readSharedSession(loadUrl, 'share-id1', '')).rejects.toThrow(
      /lost its key/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says the key is wrong when the decrypt fails', async () => {
    const { sessionParam } = await upload()

    await expect(
      readSharedSession(
        loadUrl,
        `${sessionParam.slice(0, -16)}${'w'.repeat(16)}`,
      ),
    ).rejects.toThrow(/key in the link is wrong/)
  })

  it('says the key is wrong when a wrong key happens to unpad', async () => {
    const { sessionParam, stored } = await upload()
    let wrongKey = ''
    for (let i = 0; !wrongKey; i++) {
      const candidate = `${i}`.padStart(16, 'w')
      try {
        await aesDecryptBytes(stored, candidate)
        wrongKey = candidate
      } catch {}
    }

    await expect(
      readSharedSession(loadUrl, `${sessionParam.slice(0, -16)}${wrongKey}`),
    ).rejects.toThrow(/key in the link is wrong/)
  })
})

describe('readSessionFromDynamo', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  describe('sessionId extraction', () => {
    it('strips share- prefix and uses remainder as sessionId in the URL', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      await readSessionFromDynamo(
        'https://api.example.com/',
        'share-myId123',
        'pass',
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/?sessionId=myId123',
        expect.anything(),
      )
    })

    it('URL-encodes the sessionId', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      await readSessionFromDynamo(
        'https://api.example.com/',
        'share-id with spaces',
        'pass',
      )
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/?sessionId=id%20with%20spaces',
        expect.anything(),
      )
    })

    it('passes signal to fetch', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      const controller = new AbortController()
      await readSessionFromDynamo(
        'https://api.example.com/',
        'share-abc',
        'pass',
        controller.signal,
      )
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })
  })

  describe('missing session field', () => {
    it('throws a clear error when the response has no session', async () => {
      fetchMock.mockResponse(JSON.stringify({}))
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-gone', 'pass'),
      ).rejects.toThrow(/cut short, or have expired/)
    })
  })

  // the key is only ever in the link, so both of these are what a user sees
  // when a chat client clips the URL — the cipher's own message ("The
  // operation failed for an operation-specific reason") explains nothing
  describe('key problems', () => {
    it('says the link has lost its key, without fetching', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-abc', ''),
      ).rejects.toThrow(/lost its key/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('says the key is wrong when the decrypt fails', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      jest.mocked(aesDecrypt).mockRejectedValueOnce(new Error('OperationError'))
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-abc', 'bad'),
      ).rejects.toThrow(/key in the link is wrong or the link was truncated/)
    })
  })

  describe('error message extraction', () => {
    it('uses message field from JSON error body', async () => {
      fetchMock.mockResponse(JSON.stringify({ message: 'session not found' }), {
        status: 404,
      })
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('session not found')
    })

    it('uses raw body when JSON has no message field', async () => {
      fetchMock.mockResponse(
        JSON.stringify({ error: 'something went wrong' }),
        {
          status: 500,
        },
      )
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('{"error":"something went wrong"}')
    })

    it('uses raw body when response is not JSON', async () => {
      fetchMock.mockResponse('Internal Server Error', { status: 500 })
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('Internal Server Error')
    })
  })
})

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
    expect(() => b64PadSuffix('a')).toThrow('Illegal base64url string!')
    expect(() => b64PadSuffix('abcda')).toThrow('Illegal base64url string!')
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

  // made by the pako-esm2 encoder every link before the native streams used
  it('decodes a link made before the switch to CompressionStream', async () => {
    expect(
      JSON.parse(
        await fromUrlSafeB64(
          'eJyrVspLzE1VslJKVChIzM7XTS1KVChOLS7OzM9T0lEqy0wtL1ayiq5WykwBqikzBIqVVBaA1Ptk5qUmFrmn5uXnpoYBlSnVxtYCANo5GdA',
        ),
      ),
    ).toEqual({
      name: 'a pako-era session',
      views: [{ id: 'v1', type: 'LinearGenomeView' }],
    })
  })

  // pako inflated a truncated stream to whatever prefix it held, so a clipped
  // link failed later as "Unterminated string in JSON"
  it.each([0.3, 0.6, 0.95])(
    'rejects a link cut to %p of its length',
    async fraction => {
      const encoded = await toUrlSafeB64(
        JSON.stringify({
          name: 'x',
          views: Array.from({ length: 50 }, (_, i) => ({ id: `v${i}` })),
        }),
      )
      let cut = encoded.slice(0, Math.floor(encoded.length * fraction))
      if (cut.length % 4 === 1) {
        cut = cut.slice(0, -1)
      }
      await expect(fromUrlSafeB64(cut)).rejects.toThrow('incomplete or damaged')
    },
  )
})
