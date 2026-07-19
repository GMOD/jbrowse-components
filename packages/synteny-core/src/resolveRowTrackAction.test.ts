import { resolveRowTrackAction } from './resolveRowTrackAction.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (trackId: string) =>
  ({ trackId }) as unknown as AnyConfigurationModel

const pair = ['a', 'b']

test('userOpened resolves to an open action carrying the conf', () => {
  const selection = {
    type: 'userOpened',
    value: { trackId: 'opened', assemblyNames: ['a', 'b'] },
  } as unknown as ImportFormSyntenyTrack
  expect(resolveRowTrackAction(selection, [track('a')], pair)).toEqual({
    kind: 'open',
    conf: { trackId: 'opened', assemblyNames: ['a', 'b'] },
  })
})

test('userOpened order does not matter (synteny is directionless)', () => {
  const selection = {
    type: 'userOpened',
    value: { trackId: 'opened', assemblyNames: ['b', 'a'] },
  } as unknown as ImportFormSyntenyTrack
  expect(resolveRowTrackAction(selection, [track('a')], pair)).toMatchObject({
    kind: 'open',
  })
})

test('a userOpened stranded on a different pair is ignored, not applied', () => {
  // its baked assemblyNames no longer match the row pair (a row was removed or
  // an assembly changed under it); do not open it against the wrong assemblies
  const selection = {
    type: 'userOpened',
    value: { trackId: 'opened', assemblyNames: ['a', 'b'] },
  } as unknown as ImportFormSyntenyTrack
  expect(
    resolveRowTrackAction(selection, [track('x')], ['a', 'c']),
  ).toBeUndefined()
})

test('preConfigured with a valid pick shows it', () => {
  expect(
    resolveRowTrackAction(
      { type: 'preConfigured', value: 'b' },
      [track('a'), track('b')],
      pair,
    ),
  ).toEqual({ kind: 'show', trackId: 'b' })
})

test('preConfigured with a stale pick falls back to the first track', () => {
  expect(
    resolveRowTrackAction(
      { type: 'preConfigured', value: 'gone' },
      [track('a'), track('b')],
      pair,
    ),
  ).toEqual({ kind: 'show', trackId: 'a' })
})

test('an untouched (undefined) row defaults to the first track', () => {
  expect(resolveRowTrackAction(undefined, [track('a')], pair)).toEqual({
    kind: 'show',
    trackId: 'a',
  })
})

test('a tracklist row with no available tracks resolves to nothing', () => {
  expect(resolveRowTrackAction(undefined, [], pair)).toBeUndefined()
})

test('an explicit none resolves to nothing', () => {
  expect(
    resolveRowTrackAction({ type: 'none' }, [track('a')], pair),
  ).toBeUndefined()
})

test('userOpened with no value resolves to nothing (upload selected but not completed)', () => {
  // "New track" radio (or an extension option) selected but the file not yet
  // provided. The model holds { type: 'userOpened', value: undefined }.
  // Launching in this state must not open a track.
  expect(
    resolveRowTrackAction({ type: 'userOpened' }, [track('a')], pair),
  ).toBeUndefined()
})

test('userOpened with no value ignores available tracks (does not fall through to preConfigured logic)', () => {
  // Must not fall through to the preConfigured branch and auto-pick a track.
  expect(
    resolveRowTrackAction({ type: 'userOpened' }, [track('a'), track('b')], pair),
  ).toBeUndefined()
})
