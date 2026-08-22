import createViewState from './createViewState.ts'
import { decodeSession, encodeSession } from './sessionUrl.ts'

const assembly = {
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
}

const tracks = [
  {
    type: 'VariantTrack',
    trackId: 'volvox_sv',
    name: 'volvox_sv',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  },
]

test('a session round-trips through the url form', async () => {
  const state = await createViewState({ assembly, tracks })
  state.session.setName('my session')
  state.session.view.showTrack('volvox_sv')

  const decoded = await decodeSession(await encodeSession(state))

  expect(decoded.name).toBe('my session')
  // the open track travels too, not just the session name. `session` (not
  // `defaultSession`) is the slot for a snapshot whose shape is only known at
  // runtime
  const restored = await createViewState({ assembly, tracks, session: decoded })
  expect(restored.session.view.tracks).toHaveLength(1)
})

test('the encoded form is url-safe and carries jbrowse-web`s prefix', async () => {
  const encoded = await encodeSession(
    await createViewState({ assembly, tracks }),
  )

  // the value can be dropped into jbrowse-web's `?session=` unchanged
  expect(encoded.startsWith('encoded-')).toBe(true)
  // base64url alphabet only: nothing a URL would have to percent-escape
  expect(encoded.slice('encoded-'.length)).toMatch(/^[\w-]+$/)
})

test('decodeSession rejects something that is not a session', async () => {
  await expect(decodeSession('encoded-@@@not-base64@@@')).rejects.toThrow()
})
