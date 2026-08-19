import { getConnectedAssemblies, getSyntenyTracks } from './getSyntenyTracks.ts'
import { assemblyManager, loadingAssemblyManager, track } from './testUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: (t: { configuration: { assemblyNames: string[] } }) =>
    t.configuration.assemblyNames,
}))

const cross = track('cross', 'SyntenyTrack', ['a', 'b'])
const selfA = track('selfA', 'SyntenyTrack', ['a', 'a'])
const feature = track('feature', 'FeatureTrack', ['a', 'b'])

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

  // The screen is `has`, which answers off the configs too, so an assembly the
  // manager has not built a model for yet is still a connection. Screening on
  // getCanonicalAssemblyName instead would empty this list for the whole
  // startup window and report a connected session as unconnected.
  test('an assembly configured but not yet built is still a connection', () => {
    expect(
      getConnectedAssemblies([cross], 'a', loadingAssemblyManager),
    ).toEqual(['b'])
  })

  // A caller reads the anchor off a row, and a row that has not navigated yet
  // names no assembly. getSyntenyTracks answers an empty *request* with every
  // synteny track, deliberately, so without the guard a blank anchor reports
  // the whole session as connected to it.
  test('an unnamed anchor is connected to nothing', () => {
    expect(connected([cross, selfA], '')).toEqual([])
  })
})
