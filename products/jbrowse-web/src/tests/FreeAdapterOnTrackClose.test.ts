import { cachedAdapterCount } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TRACK_ID = 'volvox_filtered_vcf'

interface TestView {
  launchTrack: (id: string) => Promise<unknown>
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
  const { rootModel } = await getPluginManager()
  const { session } = rootModel
  const view1 = session!.views[0] as unknown as TestView
  const view2 = session!.addView('LinearGenomeView', {}) as unknown as TestView
  return { rootModel, view1, view2 }
}

// builds the track's adapter the way its fetches do, under its session
async function buildTrackAdapter(
  rootModel: Awaited<ReturnType<typeof setup>>['rootModel'],
  view: TestView,
) {
  const track = view.tracks.find(t => t.configuration.trackId === TRACK_ID)!
  const before = cachedAdapterCount()
  await rootModel.rpcManager.call(track.rpcSessionId, 'CoreGetRefNames', {
    adapterConfig: getSnapshot<Record<string, unknown>>(
      track.configuration.adapter,
    ),
  })
  expect(cachedAdapterCount()).toBe(before + 1)
  return before
}

test('a track in two views frees its adapter only when the last view closes it', async () => {
  const { rootModel, view1, view2 } = await setup()
  await view1.launchTrack(TRACK_ID)
  await view2.launchTrack(TRACK_ID)
  // both views hold the same rpcSessionId, since it is derived from the
  // adapter config rather than from the track model
  expect(view2.tracks[0]!.rpcSessionId).toBe(view1.tracks[0]!.rpcSessionId)
  const before = await buildTrackAdapter(rootModel, view1)

  view1.hideTrack(TRACK_ID)
  await settle()
  expect(cachedAdapterCount()).toBe(before + 1)

  view2.hideTrack(TRACK_ID)
  await settle()
  expect(cachedAdapterCount()).toBe(before)
})

test('closing the only view holding a track frees its adapter', async () => {
  const { rootModel, view1 } = await setup()
  await view1.launchTrack(TRACK_ID)
  const before = await buildTrackAdapter(rootModel, view1)

  view1.hideTrack(TRACK_ID)
  await settle()
  expect(cachedAdapterCount()).toBe(before)
})

// destroying a session instantiates any never-observed node on the way down and
// runs its afterAttach during death finalization — see destroyViewState. The
// retain added there must not throw in that window.
test('destroying a session with an unobserved track does not throw', async () => {
  const { rootModel, view1 } = await setup()
  await view1.launchTrack(TRACK_ID)
  await settle()

  expect(() => {
    rootModel.setSession({ name: 'replacement' })
  }).not.toThrow()
})
