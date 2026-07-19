import { createLinearGenomeView } from './index.ts'

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

function featureTrack(trackId: string) {
  return {
    type: 'FeatureTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  }
}

const shownIds = (view: { tracks: { configuration: { trackId: string } }[] }) =>
  view.tracks.map(t => t.configuration.trackId).sort()

test('a full-config track seeds the catalog, not sessionTracks (no shadow copy)', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1')],
  })
  const state = await controller.whenReady()

  // the track shows once, and it stays a catalog track — re-adding a config
  // already in the catalog must not push a duplicate into sessionTracks
  expect(shownIds(state.session.view)).toEqual(['t1'])
  expect(state.session.sessionTracks).toHaveLength(0)
  controller.destroy()
})

test('setTracks opens the wanted set and closes the rest, idempotently', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1')],
  })
  const state = await controller.whenReady()
  const { view } = state.session

  controller.setTracks([featureTrack('t1'), featureTrack('t2')])
  expect(shownIds(view)).toEqual(['t1', 't2'])

  // re-applying the same set is a no-op, still no sessionTracks growth for the
  // catalog track
  controller.setTracks([featureTrack('t1'), featureTrack('t2')])
  expect(shownIds(view)).toEqual(['t1', 't2'])

  controller.setTracks([featureTrack('t2')])
  expect(shownIds(view)).toEqual(['t2'])
  controller.destroy()
})

test('addTrack/removeTrack toggle a single track', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, { assembly, tracks: [] })
  const state = await controller.whenReady()
  const { view } = state.session

  controller.addTrack(featureTrack('t1'))
  expect(shownIds(view)).toEqual(['t1'])

  controller.removeTrack('t1')
  expect(shownIds(view)).toEqual([])
  controller.destroy()
})
