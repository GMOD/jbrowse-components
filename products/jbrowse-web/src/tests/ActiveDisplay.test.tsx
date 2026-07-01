import { getPluginManager } from './util.tsx'

function getTrackAndDisplay(trackId: string) {
  const { rootModel } = getPluginManager()
  const session = rootModel.session!
  const view = session.views[0] as {
    showTrack: (id: string) => void
    tracks: {
      trackId: string
      activeDisplay: { type: string; [key: string]: unknown }
      displays: { type: string; [key: string]: unknown }[]
    }[]
  }
  view.showTrack(trackId)
  const track = view.tracks.find(t => t.trackId === trackId)!
  return { track, display: track.displays[0]! }
}

test('activeDisplay returns displays[0]', () => {
  const { track } = getTrackAndDisplay('volvox_gc')
  expect(track.activeDisplay).toBe(track.displays[0])
})
