import {
  aesEncrypt,
  encodeSessionParam,
  toUrlSafeB64,
} from '@jbrowse/core/util'

import { decodeSessionFromUrl } from './sessionUrl.ts'

// The claim these helpers make to embedded hosts is that a link built by an
// embedded product opens in jbrowse-web and vice versa. That only holds while
// this module and core's share-dialog encoder agree byte for byte, so assert it
// rather than restating it in a comment.
test('the encoded form is jbrowse-web`s `long` share mode', async () => {
  const snap = { name: 'shared session', views: [{ id: 'v', type: 'X' }] }

  const { sessionParam } = await encodeSessionParam('long', snap, {
    shareURL: '',
    referer: '',
  })

  expect(sessionParam).toBe(
    `encoded-${await toUrlSafeB64(JSON.stringify(snap))}`,
  )
  // and the decoder accepts what that producer emits, prefix included
  await expect(decodeSessionFromUrl(sessionParam)).resolves.toEqual(snap)
})

test('decodeSessionFromUrl accepts a value with the prefix stripped', async () => {
  const raw = await toUrlSafeB64(JSON.stringify({ name: 'bare' }))

  await expect(decodeSessionFromUrl(raw)).resolves.toEqual({ name: 'bare' })
})

test('decodeSessionFromUrl rejects something that is not a session', async () => {
  // a truncated link, or a `share-`/`spec-` param an embedded host can't handle
  await expect(
    decodeSessionFromUrl(await toUrlSafeB64(JSON.stringify([1, 2, 3]))),
  ).rejects.toThrow('not a session')
  await expect(
    decodeSessionFromUrl(await toUrlSafeB64(JSON.stringify({ noName: true }))),
  ).rejects.toThrow('not a session')
  await expect(
    decodeSessionFromUrl('encoded-@@@not-base64@@@'),
  ).rejects.toThrow()
})

// the hand-written form urlparams.md teaches
test('decodeSessionFromUrl reads a json- session', async () => {
  const snap = { name: 'plain', views: [] }
  const sessionParam = `json-${JSON.stringify({ session: snap })}`

  await expect(decodeSessionFromUrl(sessionParam)).resolves.toEqual(snap)
  await expect(
    decodeSessionFromUrl(sessionParam.slice(0, -10)),
  ).rejects.toThrow('incomplete')
  await expect(decodeSessionFromUrl('json-{"notSession":1}')).rejects.toThrow(
    'not a session',
  )
})

describe('a share- value', () => {
  const loadUrl = 'https://share.example/api/v1/load'

  async function serve(session: unknown, password: string) {
    fetchMock.mockResponseOnce(
      JSON.stringify({
        session: await aesEncrypt(
          await toUrlSafeB64(JSON.stringify(session)),
          password,
        ),
      }),
    )
  }

  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('is fetched from the share service and decrypted', async () => {
    await serve({ name: 'uploaded' }, 'pw')

    await expect(
      decodeSessionFromUrl('share-abc', { loadUrl, password: 'pw' }),
    ).resolves.toEqual({ name: 'uploaded' })
    expect(fetchMock).toHaveBeenCalledWith(
      `${loadUrl}?sessionId=abc`,
      expect.anything(),
    )
  })

  test('is checked for a session like the inline forms', async () => {
    await serve([1, 2, 3], 'pw')

    await expect(
      decodeSessionFromUrl('share-abc', { loadUrl, password: 'pw' }),
    ).rejects.toThrow('not a session')
  })

  // an embedded product has no share service to name
  test('throws without a share service, fetching nothing', async () => {
    await expect(decodeSessionFromUrl('share-abc')).rejects.toThrow(
      /needs a share service/,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
