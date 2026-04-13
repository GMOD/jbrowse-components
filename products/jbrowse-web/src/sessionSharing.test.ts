jest.mock('@jbrowse/core/util', () => ({
  aesDecrypt: jest.fn().mockResolvedValue('decrypted-session-data'),
  aesEncrypt: jest.fn().mockResolvedValue('encrypted-data'),
}))

import { readSessionFromDynamo } from './sessionSharing.ts'

afterEach(() => {
  // @ts-expect-error
  fetch.resetMocks()
})

describe('readSessionFromDynamo', () => {
  describe('sessionId extraction', () => {
    it('strips share- prefix and uses remainder as sessionId in the URL', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce(JSON.stringify({ session: 'enc' }))
      await readSessionFromDynamo('https://api.example.com/', 'share-myId123', 'pass')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/?sessionId=myId123',
        expect.anything(),
      )
    })

    it('URL-encodes the sessionId', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce(JSON.stringify({ session: 'enc' }))
      await readSessionFromDynamo('https://api.example.com/', 'share-id with spaces', 'pass')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/?sessionId=id%20with%20spaces',
        expect.anything(),
      )
    })

    it('passes signal to fetch', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce(JSON.stringify({ session: 'enc' }))
      const controller = new AbortController()
      await readSessionFromDynamo('https://api.example.com/', 'share-abc', 'pass', controller.signal)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })
  })

  describe('error message extraction', () => {
    it('uses message field from JSON error body', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce(JSON.stringify({ message: 'session not found' }), { status: 404 })
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('session not found')
    })

    it('uses raw body when JSON has no message field', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce(JSON.stringify({ error: 'something went wrong' }), { status: 500 })
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('{"error":"something went wrong"}')
    })

    it('uses raw body when response is not JSON', async () => {
      // @ts-expect-error
      fetch.mockResponseOnce('Internal Server Error', { status: 500 })
      await expect(
        readSessionFromDynamo('https://api.example.com/', 'share-xyz', 'pass'),
      ).rejects.toThrow('Internal Server Error')
    })
  })
})
