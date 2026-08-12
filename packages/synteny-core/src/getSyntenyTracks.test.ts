import { getConnectedAssemblies, getSyntenyTracks } from './getSyntenyTracks.ts'

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

// 'aliasOfA' is another name for assembly 'a'; 'ghost' is named by a track and
// configured by nothing, which is what the real manager answers undefined for;
// every other name is its own
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    name === 'aliasOfA' ? 'a' : name === 'ghost' ? undefined : name,
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

describe('getConnectedAssemblies', () => {
  const connected = (tracks: AnyConfigurationModel[], assembly: string) =>
    getConnectedAssemblies(tracks, assembly, assemblyManager)

  test('the other endpoint of every dataset naming the assembly', () => {
    expect(connected([cross, selfA, feature], 'a')).toEqual(['b'])
  })

  test('a self-alignment connects the assembly to nothing new', () => {
    expect(connected([selfA], 'a')).toEqual([])
  })

  // the caller defaults a row to one of these, and a row holding a name the
  // session has no assembly for renders as an empty Select
  test('an assembly the session cannot open is not a connection', () => {
    const ghost = track('ghost', 'SyntenyTrack', ['a', 'ghost'])
    expect(connected([ghost], 'a')).toEqual([])
  })

  test('an unopenable endpoint does not shadow a usable one', () => {
    const ghost = track('ghost', 'SyntenyTrack', ['a', 'ghost'])
    expect(connected([ghost, cross], 'a')).toEqual(['b'])
  })

  // both sides resolve, so a dataset naming the alias still connects
  test('an alias on either side still connects', () => {
    const aliased = track('aliased', 'SyntenyTrack', ['aliasOfA', 'b'])
    expect(connected([aliased], 'a')).toEqual(['b'])
    expect(connected([cross], 'aliasOfA')).toEqual(['b'])
  })
})
