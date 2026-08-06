import { isAlive } from '@jbrowse/mobx-state-tree'

import { createLinearGenomeView } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})
// Every assembly below is a config, so nothing here resolves a hub — this keeps
// it that way. Passing a hub NAME would make a unit test fetch over the network,
// and it is one character of difference from what these tests already write.
jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

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

// same shape, minus assemblyNames — what a host that leaves the assembly to the
// view sends
function unstampedTrack(trackId: string) {
  const { assemblyNames, ...rest } = featureTrack(trackId)
  return rest
}

const shownIds = (view: { tracks: { configuration: { trackId: string } }[] }) =>
  view.tracks.map(t => t.configuration.trackId).sort()

const assemblyNamesOf = (
  session: { getTrackById: (id: string) => unknown },
  trackId: string,
) =>
  (session.getTrackById(trackId) as { assemblyNames: string[] }).assemblyNames

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

// The `tracks` option is what a host declares, and it is applied once, at
// build. There is no setTracks to re-apply it with: a host that wants a
// different set builds a different browser.
test('the declared tracks are the ones shown', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, {
    assembly,
    tracks: [featureTrack('t1'), featureTrack('t2')],
  })
  const state = await controller.whenReady()

  expect(shownIds(state.session.view)).toEqual(['t1', 't2'])
  // seeded into the config catalog, so opening them adds no session tracks
  expect(state.session.sessionTracks).toHaveLength(0)
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

// Hosts (R htmlwidgets, anywidget, vanilla JS) hand over track configs without
// an assemblyNames, leaving it to the view — which knows the resolved name even
// when the assembly arrived as a hub name it had to fetch. That stamping has to
// cover the tracks that arrive after mount too: those never pass through the
// build() catalog seed, so before this they reached addTrackConf bare and
// silently never displayed.
test('assemblyNames is stamped onto full configs arriving after mount', async () => {
  const el = document.createElement('div')
  const controller = createLinearGenomeView(el, { assembly, tracks: [] })
  const state = await controller.whenReady()
  const { session } = state

  controller.addTrack(unstampedTrack('t1'))
  expect(assemblyNamesOf(session, 't1')).toEqual(['volvox'])

  controller.addTrack(unstampedTrack('t2'))
  expect(assemblyNamesOf(session, 't2')).toEqual(['volvox'])
  expect(shownIds(session.view)).toEqual(['t1', 't2'])
  controller.destroy()
})

// (that an explicit assemblyNames survives the stamp is withAssemblyName's own
// test — asserting it here would need a track pinned to an assembly this view
// has never heard of, which is just a resolution error in disguise)

// React unmount does not own the engine: without an explicit teardown the MST
// tree stays alive with its autoruns running and its RPC worker pool orphaned,
// which is a per-mount leak for hosts that mount and discard repeatedly (a
// Jupyter cell re-run, an SPA route change).
test('destroy tears down the engine, not just the React root', async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly,
  })
  const state = await controller.whenReady()
  const destroyDrivers = jest.spyOn(state.rpcManager, 'destroy')

  controller.destroy()

  expect(destroyDrivers).toHaveBeenCalled()
  expect(isAlive(state)).toBe(false)
})

test('destroy is idempotent, and works before the first build settles', async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly,
  })

  // StrictMode runs a ref callback's cleanup immediately after setup, so this
  // lands before the async build ever renders
  expect(() => {
    controller.destroy()
    controller.destroy()
  }).not.toThrow()
  await controller.whenReady()
})

// A host swapping genomes now destroys the controller and creates another,
// which is what setAssembly did internally. What has to hold for that to be a
// real replacement rather than a leak: the first engine is dead and its worker
// pool with it, and the second is alive and independent. Two controllers over
// the same element, since that is the host's actual sequence.
test('destroying a controller and creating another swaps the genome cleanly', async () => {
  const el = document.createElement('div')
  const first = createLinearGenomeView(el, { assembly })
  const firstState = await first.whenReady()
  first.destroy()

  const second = createLinearGenomeView(el, {
    assembly: { ...assembly, name: 'volvox2' },
  })
  const secondState = await second.whenReady()

  expect(secondState).not.toBe(firstState)
  expect(isAlive(firstState)).toBe(false)
  expect(isAlive(secondState)).toBe(true)
  expect(secondState.session.assemblyNames).toEqual(['volvox2'])
  second.destroy()
})
