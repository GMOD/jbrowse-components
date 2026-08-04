import { toUrlSafeB64 } from '@jbrowse/core/util'

import createViewState from './createViewState.ts'
import { decodeSession, encodeSession } from './sessionUrl.ts'

jest.mock('./makeWorkerInstance', () => () => {})

const config = {
  assemblies: [
    {
      name: 'volvox',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'volvox_refseq',
        adapter: {
          type: 'FromConfigSequenceAdapter',
          features: [
            {
              refName: 'ctgA',
              uniqueId: 'firstId',
              start: 0,
              end: 10,
              seq: 'cattgttgcg',
            },
          ],
        },
      },
    },
  ],
}

test('a session round-trips through the url form', async () => {
  const viewState = createViewState({
    config: { ...config, defaultSession: { name: 'my session' } },
  })
  viewState.session.addView('LinearGenomeView', { id: 'lgv1' })

  const encoded = await encodeSession(viewState)
  const decoded = await decodeSession(encoded)

  expect(decoded.name).toBe('my session')
  expect(decoded.views).toEqual([
    expect.objectContaining({ id: 'lgv1', type: 'LinearGenomeView' }),
  ])
})

test('the encoded form is url-safe and compressed', async () => {
  const viewState = createViewState({
    config: { ...config, defaultSession: { name: 'my session' } },
  })
  const encoded = await encodeSession(viewState)

  // the `encoded-` prefix is jbrowse-web's, so the value can be dropped into
  // that app's `?session=` unchanged
  expect(encoded.startsWith('encoded-')).toBe(true)
  // base64url alphabet only: nothing a URL would have to percent-escape
  expect(encoded.slice('encoded-'.length)).toMatch(/^[\w-]+$/)
})

test('decodeSession accepts a value with the prefix already stripped', async () => {
  const raw = await toUrlSafeB64(JSON.stringify({ name: 'bare' }))

  await expect(decodeSession(raw)).resolves.toEqual({ name: 'bare' })
  await expect(decodeSession(`encoded-${raw}`)).resolves.toEqual({
    name: 'bare',
  })
})

test('decodeSession rejects something that is not a session', async () => {
  const notASession = await toUrlSafeB64(JSON.stringify([1, 2, 3]))

  await expect(decodeSession(notASession)).rejects.toThrow('not a session')
  await expect(decodeSession('encoded-@@@not-base64@@@')).rejects.toThrow()
})

test('a decoded session can be restored via the session option', async () => {
  const first = createViewState({
    config: { ...config, defaultSession: { name: 'declarative' } },
  })
  first.session.addView('LinearGenomeView', { id: 'restored-view' })
  const encoded = await encodeSession(first)

  const second = createViewState({
    config: { ...config, defaultSession: { name: 'declarative' } },
    session: await decodeSession(encoded),
  })

  expect(second.session.views).toHaveLength(1)
  expect(second.session.views[0]!.id).toBe('restored-view')
  // the config's defaultSession is untouched, so File > New session still
  // returns to the app's own starting state rather than the restored one
  second.setDefaultSession()
  expect(second.session.name).toMatch(/^declarative /)
  expect(second.session.views).toHaveLength(0)
})
