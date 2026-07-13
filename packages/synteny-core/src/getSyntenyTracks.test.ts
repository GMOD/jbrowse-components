import { getSyntenyTracks } from './getSyntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const track = (trackId: string, type: string, assemblyNames: string[]) =>
  ({
    trackId,
    type,
    configuration: { assemblyNames },
  }) as unknown as AnyConfigurationModel

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: (t: { configuration: { assemblyNames: string[] } }) =>
    t.configuration.assemblyNames,
}))

const cross = track('cross', 'SyntenyTrack', ['a', 'b'])
const selfA = track('selfA', 'SyntenyTrack', ['a', 'a'])
const feature = track('feature', 'FeatureTrack', ['a', 'b'])

test('matches a pairwise synteny track for a distinct pair', () => {
  expect(getSyntenyTracks([cross, selfA, feature], ['a', 'b'])).toEqual([cross])
})

test('a duplicate pair only matches a genuine self-alignment track', () => {
  expect(getSyntenyTracks([cross, selfA, feature], ['a', 'a'])).toEqual([selfA])
})

test('an empty request returns every synteny track', () => {
  expect(getSyntenyTracks([cross, selfA, feature], [])).toEqual([cross, selfA])
})

test('ignores non-synteny track types', () => {
  expect(getSyntenyTracks([feature], ['a', 'b'])).toEqual([])
})
