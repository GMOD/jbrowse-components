import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getPluginManager } from './util.tsx'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// Documents the actual serialized shape of display configs, which the
// getConfigOverrides.ts comment makes claims about. A track's displays are
// injected by baseTrackConfig.preProcessSnapshot with a unique displayId (a
// types.identifier), so they never serialize to `{}` and always retain type +
// displayId — even when every other slot is default.
function getTrack(trackId: string) {
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.views[0] as {
    showTrack: (id: string) => void
    tracks: {
      trackId: string
      configuration: IAnyStateTreeNode
      displays: { configuration: IAnyStateTreeNode }[]
    }[]
  }
  view.showTrack(trackId)
  return view.tracks.find(t => t.trackId === trackId)!
}

interface TrackSnap {
  trackId: string
  displays?: { type?: string; displayId?: string }[]
}

test('getSnapshot(trackConfig).displays keeps type + displayId (not stripped to {})', () => {
  const track = getTrack('volvox_filtered_vcf')
  const snap: TrackSnap = getSnapshot(track.configuration)
  expect(snap.displays?.length).toBeGreaterThan(0)
  for (const d of snap.displays!) {
    expect(d).not.toEqual({})
    expect(d.type).toBeTruthy()
    expect(d.displayId).toBe(`${snap.trackId}-${d.type}`)
  }
})

test('getSnapshot(displayConfig) retains displayId (not stripped as an identifier)', () => {
  const track = getTrack('volvox_filtered_vcf')
  const displayConf = track.displays[0]!.configuration
  const snap: { type?: string; displayId?: string } = getSnapshot(displayConf)
  expect(snap.type).toBeTruthy()
  expect(snap.displayId).toBeTruthy()
})
