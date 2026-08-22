import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getTestSession } from './util.tsx'

// Documents the serialized shape of display configs that the BaseTrackModel
// persistence reaction relies on. A track's displays are injected by
// baseTrackConfig.preProcessSnapshot with a unique displayId (a
// types.identifier), so they never serialize to `{}` and always retain type +
// displayId — even when every other slot is default.
async function getTrack(trackId: string) {
  const { view } = await getTestSession()
  view.showTrack(trackId)
  return view.tracks.find(t => t.trackId === trackId)!
}

interface TrackSnap {
  trackId: string
  displays?: { type?: string; displayId?: string }[]
}

test('getSnapshot(trackConfig).displays keeps type + displayId (not stripped to {})', async () => {
  const track = await getTrack('volvox_filtered_vcf')
  const snap: TrackSnap = getSnapshot(track.configuration)
  expect(snap.displays?.length).toBeGreaterThan(0)
  for (const d of snap.displays!) {
    expect(d).not.toEqual({})
    expect(d.type).toBeTruthy()
    expect(d.displayId).toBe(`${snap.trackId}-${d.type}`)
  }
})

test('getSnapshot(displayConfig) retains displayId (not stripped as an identifier)', async () => {
  const track = await getTrack('volvox_filtered_vcf')
  const displayConf = track.displays[0]!.configuration
  const snap: { type?: string; displayId?: string } = getSnapshot(displayConf)
  expect(snap.type).toBeTruthy()
  expect(snap.displayId).toBeTruthy()
})
