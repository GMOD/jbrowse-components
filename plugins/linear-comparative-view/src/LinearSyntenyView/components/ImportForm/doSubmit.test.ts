import { resolveRowTrackAction } from './doSubmit.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

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
