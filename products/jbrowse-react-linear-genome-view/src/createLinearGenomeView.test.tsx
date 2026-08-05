import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { createLinearGenomeView } from './index.ts'

import type { HubConfig } from '@jbrowse/core/util/fetchHub'

jest.mock('./makeWorkerInstance', () => () => {})
// resolving an assembly by hub name is the one await in a build, so gating it is
// how a test decides which of two in-flight rebuilds finishes first
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

  controller.setTracks([unstampedTrack('t1'), unstampedTrack('t2')])
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

// Two rebuilds in flight resolve in whatever order their assembly fetches
// finish, which is not the order they were asked for — a host switching genomes
// twice, or syncing several traits at once (anywidget, htmlwidgets), gets both.
// Whichever build lands last used to win outright, so a slow first request could
// overwrite the genome the user actually asked for, destroy the engine that was
// showing it, and leave whenReady() resolving with that dead engine.
test('the last rebuild requested wins, not the last to resolve', async () => {
  const gates = new Map<string, (hub: HubConfig) => void>()
  jest.mocked(fetchHub).mockImplementation(
    async (name: string) =>
      await new Promise<HubConfig>(resolve => {
        gates.set(name, resolve)
      }),
  )
  const openGate = async (name: string) => {
    gates.get(name)!({ assemblies: [{ ...assembly, name }] })
    // two ticks: one for the fetch, one for the build that awaited it
    await Promise.resolve()
    await Promise.resolve()
  }

  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly: 'slow',
  })
  controller.setAssembly('quick')
  await Promise.resolve()

  await openGate('quick')
  await openGate('slow')
  const state = await controller.whenReady()

  expect(controller.viewState).toBe(state)
  expect(isAlive(state)).toBe(true)
  expect(state.session.assemblyNames).toEqual(['quick'])
  controller.destroy()
})

// setAssembly/setSession rebuild the engine from scratch. The previous one has
// to die with them, or every swap orphans a worker pool — and it can only die
// after its React tree is gone, which is why the swap unmounts first.
test('a rebuild destroys the engine it replaced', async () => {
  const controller = createLinearGenomeView(document.createElement('div'), {
    assembly,
  })
  const first = await controller.whenReady()

  controller.setSession({
    name: 'restored',
    view: { type: 'LinearGenomeView' },
  })
  const second = await controller.whenReady()

  expect(second).not.toBe(first)
  expect(isAlive(first)).toBe(false)
  expect(isAlive(second)).toBe(true)
  controller.destroy()
})
