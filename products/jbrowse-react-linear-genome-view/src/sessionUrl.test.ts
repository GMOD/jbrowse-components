import createViewState, { createViewStateAsync } from './createViewState.ts'
import { decodeSession, encodeSession } from './sessionUrl.ts'

jest.mock('./makeWorkerInstance', () => () => {})

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
    type: 'FeatureTrack',
    trackId: 't1',
    name: 't1',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  },
]

test('a session round-trips through the url form', async () => {
  const state = createViewState({ assembly, tracks })
  state.session.setName('my session')
  await state.session.view.launchTrack('t1')

  const decoded = await decodeSession(await encodeSession(state))

  expect(decoded.name).toBe('my session')
  // the open track is part of what travels, not just the session name.
  // `session` (not `defaultSession`) is the slot for a snapshot whose shape is
  // only known at runtime
  // the async twin: a restored session names the display types that were open,
  // and their state models load before the tree can be built
  const restored = await createViewStateAsync({
    assembly,
    tracks,
    session: decoded,
  })
  expect(
    restored.session.view.tracks.map(t => t.configuration.trackId),
  ).toEqual(['t1'])
})

test('the encoded form is url-safe and carries jbrowse-web`s prefix', async () => {
  const encoded = await encodeSession(createViewState({ assembly, tracks }))

  // the value can be dropped into jbrowse-web's `?session=` unchanged
  expect(encoded.startsWith('encoded-')).toBe(true)
  // base64url alphabet only: nothing a URL would have to percent-escape
  expect(encoded.slice('encoded-'.length)).toMatch(/^[\w-]+$/)
})

test('decodeSession rejects something that is not a session', async () => {
  await expect(decodeSession('encoded-@@@not-base64@@@')).rejects.toThrow()
})
