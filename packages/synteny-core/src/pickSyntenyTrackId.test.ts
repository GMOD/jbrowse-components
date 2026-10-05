import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { TrackConfigEntry } from '@jbrowse/core/configuration'

const track = (trackId: string): TrackConfigEntry => ({
  trackId,
  type: 'SyntenyTrack',
})

test('keeps a still-valid preference', () => {
  expect(pickSyntenyTrackId('b', [track('a'), track('b')])).toBe('b')
})

test('falls back to the first track for a stale preference', () => {
  expect(pickSyntenyTrackId('gone', [track('a'), track('b')])).toBe('a')
})

test('falls back to the first track for an empty preference', () => {
  expect(pickSyntenyTrackId('', [track('a')])).toBe('a')
})

test('is undefined when there are no tracks', () => {
  expect(pickSyntenyTrackId('', [])).toBeUndefined()
})
