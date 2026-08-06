import { aesDecrypt } from './crypto.ts'
import { readSessionFromDynamo, shareEndpoint } from './sessionSharing.ts'

jest.mock('./crypto.ts', () => ({
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
      ).rejects.toThrow(/may have expired/)
    })
  })

  // the password is only ever in the link, so both of these are what a user
  // sees when a chat client clips the URL — the cipher's own message ("The
  // operation failed for an operation-specific reason") explains nothing
  describe('password problems', () => {
    it('says the link is missing its password, without fetching', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-abc', ''),
      ).rejects.toThrow(/missing its "password"/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('says the password is wrong when the decrypt fails', async () => {
      fetchMock.mockResponse(JSON.stringify({ session: 'enc' }))
      jest.mocked(aesDecrypt).mockRejectedValueOnce(new Error('OperationError'))
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-abc', 'bad'),
      ).rejects.toThrow(/password.*is wrong or the link was truncated/)
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
