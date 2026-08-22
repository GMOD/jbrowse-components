import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface TestView {
  showTrack: (id: string) => void
  hideTrack: (id: string) => void
  tracks: {
    rpcSessionId: string
    configuration: AnyConfigurationModel
  }[]
}

beforeEach(() => {
  doBeforeEach()
})

// the release is fired without being awaited (a disposer cannot await), so give
// the CoreFreeResources round trip a macrotask to land
function settle() {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

async function setup() {
  const { pluginManager, rootModel } = await getPluginManager()
  const { session } = rootModel
  const view1 = session!.views[0] as unknown as TestView
  const view2 = session!.addView('LinearGenomeView', {}) as unknown as TestView
  return { pluginManager, rootModel, view1, view2 }
}

test('a track in two views frees its adapter only when the last view closes it', async () => {
  const { pluginManager, view1, view2 } = await setup()
  view1.showTrack(TRACK_ID)
  view2.showTrack(TRACK_ID)

  const track = view1.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  const sessionId = track.rpcSessionId
  const conf = getSnapshot(track.configuration.adapter) as Record<
    string,
    unknown
  >
  const load = () => getAdapter(pluginManager, sessionId, conf)

  const first = await load()
  // both views hold the same rpcSessionId, since it is derived from the
  // adapter config rather than from the track model
  expect(view2.tracks[0]!.rpcSessionId).toBe(sessionId)

  view1.hideTrack(TRACK_ID)
  await settle()
  expect((await load()).dataAdapter).toBe(first.dataAdapter)

  view2.hideTrack(TRACK_ID)
  await settle()
  expect((await load()).dataAdapter).not.toBe(first.dataAdapter)
})

test('closing the only view holding a track frees its adapter', async () => {
  const { pluginManager, view1 } = await setup()
  view1.showTrack(TRACK_ID)

  const track = view1.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  const sessionId = track.rpcSessionId
  const conf = getSnapshot(track.configuration.adapter) as Record<
    string,
    unknown
  >
  const load = () => getAdapter(pluginManager, sessionId, conf)

  const first = await load()
  view1.hideTrack(TRACK_ID)
  await settle()
  expect((await load()).dataAdapter).not.toBe(first.dataAdapter)
})

// destroying a session instantiates any never-observed node on the way down and
// runs its afterAttach during death finalization — see destroyViewState. The
// retain added there must not throw in that window.
test('destroying a session with an unobserved track does not throw', async () => {
  const { rootModel, view1 } = await setup()
  view1.showTrack(TRACK_ID)
  await settle()

  expect(() => {
    rootModel.setSession({ name: 'replacement' })
  }).not.toThrow()
})
