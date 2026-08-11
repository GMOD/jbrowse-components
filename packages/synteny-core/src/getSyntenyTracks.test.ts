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

// 'aliasOfA' is another name for assembly 'a'; every other name is its own
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    name === 'aliasOfA' ? 'a' : name,
}
const matching = (tracks: AnyConfigurationModel[], assemblies: string[]) =>
  getSyntenyTracks(tracks, assemblies, assemblyManager)

test('matches a pairwise synteny track for a distinct pair', () => {
  expect(matching([cross, selfA, feature], ['a', 'b'])).toEqual([cross])
})

test('a duplicate pair only matches a genuine self-alignment track', () => {
  expect(matching([cross, selfA, feature], ['a', 'a'])).toEqual([selfA])
})

test('an empty request returns every synteny track', () => {
  expect(matching([cross, selfA, feature], [])).toEqual([cross, selfA])
})

test('ignores non-synteny track types', () => {
  expect(matching([feature], ['a', 'b'])).toEqual([])
})

// the row names the assembly one way, the track config names it another
test('an alias on either side still matches', () => {
  expect(matching([cross, selfA, feature], ['aliasOfA', 'b'])).toEqual([cross])
  expect(
    matching([track('aliased', 'SyntenyTrack', ['aliasOfA', 'b'])], ['a', 'b']),
  ).toEqual([track('aliased', 'SyntenyTrack', ['aliasOfA', 'b'])])
})

// multiplicity is counted after resolution, so a self-alignment written with
// the alias on one side is still a self-alignment
test('a self-alignment written through an alias is still one', () => {
  const selfAliased = track('selfAliased', 'SyntenyTrack', ['a', 'aliasOfA'])
  expect(matching([cross, selfAliased], ['a', 'a'])).toEqual([selfAliased])
})
