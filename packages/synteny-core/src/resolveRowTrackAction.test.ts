import { resolveRowTrackAction } from './resolveRowTrackAction.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (trackId: string) =>
  ({ trackId }) as unknown as AnyConfigurationModel

test('userOpened resolves to an open action carrying the conf', () => {
  const selection = {
    type: 'userOpened',
    value: { trackId: 'opened' },
  } as unknown as ImportFormSyntenyTrack
  expect(resolveRowTrackAction(selection, [track('a')])).toEqual({
    kind: 'open',
    conf: { trackId: 'opened' },
  })
})

test('preConfigured with a valid pick shows it', () => {
  expect(
    resolveRowTrackAction({ type: 'preConfigured', value: 'b' }, [
      track('a'),
      track('b'),
    ]),
  ).toEqual({ kind: 'show', trackId: 'b' })
})

test('preConfigured with a stale pick falls back to the first track', () => {
  expect(
    resolveRowTrackAction({ type: 'preConfigured', value: 'gone' }, [
      track('a'),
      track('b'),
    ]),
  ).toEqual({ kind: 'show', trackId: 'a' })
})

test('an untouched (undefined) row defaults to the first track', () => {
  expect(resolveRowTrackAction(undefined, [track('a')])).toEqual({
    kind: 'show',
    trackId: 'a',
  })
})

test('a tracklist row with no available tracks resolves to nothing', () => {
  expect(resolveRowTrackAction(undefined, [])).toBeUndefined()
})

test('an explicit none resolves to nothing', () => {
  expect(resolveRowTrackAction({ type: 'none' }, [track('a')])).toBeUndefined()
})

test('userOpened with no value resolves to nothing (upload selected but not completed)', () => {
  // Extension option or custom upload radio clicked but file not yet provided.
  // The model holds { type: 'userOpened', value: undefined } transiently.
  // Launching in this state should not open a track.
  expect(
    resolveRowTrackAction(
      {
        type: 'userOpened',
        value: undefined,
      } as unknown as ImportFormSyntenyTrack,
      [track('a')],
    ),
  ).toBeUndefined()
})

test('userOpened with no value ignores available tracks (does not fall through to preConfigured logic)', () => {
  // Must not fall through to the preConfigured branch and auto-pick a track.
  expect(
    resolveRowTrackAction(
      {
        type: 'userOpened',
        value: undefined,
      } as unknown as ImportFormSyntenyTrack,
      [track('a'), track('b')],
    ),
  ).toBeUndefined()
})
