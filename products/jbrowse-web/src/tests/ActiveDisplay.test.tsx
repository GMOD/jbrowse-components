import { getTestSession } from './util.tsx'

test('activeDisplay returns displays[0]', () => {
  const { view } = getTestSession()
  view.showTrack('volvox_gc')
  const track = view.tracks.find(t => t.trackId === 'volvox_gc')!
  expect(track.activeDisplay).toBe(track.displays[0])
})
