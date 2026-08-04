import { encodeSessionParam, toUrlSafeB64 } from '@jbrowse/core/util'

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
