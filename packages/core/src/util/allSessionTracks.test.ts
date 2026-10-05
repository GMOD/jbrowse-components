import { allSessionTracks } from './tracks.ts'

import type {
  AnyConfigurationModel,
  TrackConfigEntry,
} from '../configuration/index.ts'

const track = (trackId: string): TrackConfigEntry => ({
  trackId,
  type: 'FeatureTrack',
})
const connectionTrack = (trackId: string) =>
  track(trackId) as unknown as AnyConfigurationModel

test('connection tracks are included, so a hub track is visible', () => {
  expect(
    allSessionTracks({
      tracks: [track('a')],
      connectionInstances: [{ tracks: [connectionTrack('b')] }],
    }),
  ).toEqual([track('a'), track('b')])
})

test('every connection contributes', () => {
  expect(
    allSessionTracks({
      tracks: [],
      connectionInstances: [
        { tracks: [connectionTrack('b')] },
        { tracks: [connectionTrack('c')] },
      ],
    }),
  ).toEqual([track('b'), track('c')])
})

test('session tracks are not doubled', () => {
  // session.tracks already contains sessionTracks, so callers must not union
  // those two themselves
  const tracks = [track('session'), track('config')]
  expect(allSessionTracks({ tracks })).toEqual(tracks)
})

test('a session without connections is passed through by identity', () => {
  // keeps the hydration cache warm for the common case (see SessionTracks)
  const tracks = [track('a')]
  expect(allSessionTracks({ tracks })).toBe(tracks)
  expect(allSessionTracks({ tracks, connectionInstances: [] })).toBe(tracks)
})
