import { pickSyntenyTrackId } from './getSyntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (trackId: string) =>
  ({ trackId }) as unknown as AnyConfigurationModel

test('keeps a still-valid preference', () => {
  expect(
    pickSyntenyTrackId('b', [track('a'), track('b')]),
  ).toBe('b')
})

test('falls back to the first track for a stale preference', () => {
  expect(
    pickSyntenyTrackId('gone', [track('a'), track('b')]),
  ).toBe('a')
})

test('falls back to the first track for an empty preference', () => {
  expect(pickSyntenyTrackId('', [track('a')])).toBe('a')
})

test('is undefined when there are no tracks', () => {
  expect(pickSyntenyTrackId('', [])).toBeUndefined()
})
