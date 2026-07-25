import { allSessionTracks } from './allSessionTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const track = (trackId: string) =>
  ({ trackId }) as unknown as AnyConfigurationModel

const session = (
  tracks: AnyConfigurationModel[],
  connectionInstances?: { tracks: AnyConfigurationModel[] }[],
) => ({ tracks, connectionInstances }) as unknown as AbstractSessionModel

test('connection tracks are included, so a hub synteny track is visible', () => {
  expect(
    allSessionTracks(session([track('a')], [{ tracks: [track('b')] }])),
  ).toEqual([track('a'), track('b')])
})

test('every connection contributes', () => {
  expect(
    allSessionTracks(
      session([], [{ tracks: [track('b')] }, { tracks: [track('c')] }]),
    ),
  ).toEqual([track('b'), track('c')])
})

test('a session without connections is passed through by identity', () => {
  // keeps the hydration cache warm for the common case (see SessionTracks)
  const tracks = [track('a')]
  expect(allSessionTracks(session(tracks))).toBe(tracks)
  expect(allSessionTracks(session(tracks, []))).toBe(tracks)
})
