import {
  dotplotAxesFromRows,
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'

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
const ava = track('ava', 'SyntenyTrack', ['a', 'b', 'c', 'd'])
const selfA = track('selfA', 'SyntenyTrack', ['a', 'a'])
const lone = track('lone', 'SyntenyTrack', ['a'])
const feature = track('feature', 'FeatureTrack', ['a', 'b'])

test('a pairwise track fills two rows', () => {
  expect(syntenyTrackRows(cross)).toEqual(['a', 'b'])
})

test('an all-vs-all track stacks every assembly it names', () => {
  expect(syntenyTrackRows(ava)).toEqual(['a', 'b', 'c', 'd'])
})

test('a self-alignment track keeps its repeated assembly', () => {
  expect(syntenyTrackRows(selfA)).toEqual(['a', 'a'])
})

// 'ghost' is named by a track and configured by nothing, which is what the real
// manager answers undefined for; every other name is its own
const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    name === 'ghost' ? undefined : name,
  has: (name: string) => name !== 'ghost',
}
const quickStart = (tracks: AnyConfigurationModel[]) =>
  quickStartSyntenyTracks(tracks, assemblyManager)

test('quick start offers every launchable synteny track', () => {
  expect(quickStart([cross, ava, selfA, feature])).toEqual([cross, ava, selfA])
})

test('quick start omits a track naming fewer than two assemblies', () => {
  expect(quickStart([cross, lone])).toEqual([cross])
})

// Quick start is the opening mode whenever anything qualifies, so offering one
// of these seeded the form with a row the assembly Select renders empty, and
// Launch built a row whose init fails with "Assembly ghost not found".
test('quick start omits a track naming an assembly the session lacks', () => {
  const ghost = track('ghost', 'SyntenyTrack', ['a', 'ghost'])
  expect(quickStart([cross, ghost])).toEqual([cross])
})

test('one unopenable endpoint disqualifies the whole all-vs-all track', () => {
  // every row it implies becomes a row, so one bad name is one bad row
  const avaGhost = track('avaGhost', 'SyntenyTrack', ['a', 'b', 'ghost'])
  expect(quickStart([avaGhost])).toEqual([])
})

// The screen is `has`, which answers off the configs too. Screening on
// getCanonicalAssemblyName instead would reject every track for the whole
// startup window, so a session with a launchable dataset would open on Manual —
// which is the regression the first version of this had.
test('a track whose assemblies are configured but not built still qualifies', () => {
  const loading = {
    getCanonicalAssemblyName: () => undefined,
    has: () => true,
  }
  expect(quickStartSyntenyTracks([cross], loading)).toEqual([cross])
})

// This mapping has been written backwards more than once. assemblyNames is
// [query, target] and the dotplot's assembly1/assembly2 are (y, x), so the query
// goes on y. If this test fails, the mapping was flipped — check
// dotplotAxesFromRows' comment before "fixing" the expectation.
test('the query (first assembly) goes on the y-axis, the target on x', () => {
  expect(dotplotAxesFromRows(syntenyTrackRows(cross))).toEqual({
    y: 'a',
    x: 'b',
  })
})

test('Swap puts each assembly on the other axis', () => {
  expect(dotplotAxesFromRows(syntenyTrackRows(cross), true)).toEqual({
    y: 'b',
    x: 'a',
  })
})

// Swap used to be applied by reversing the row list, which for this track means
// ['d','c','b','a'] and so plots (c, d) rather than transposing (a, b).
test('Swap on an all-vs-all track transposes its pair, not which pair', () => {
  const rows = syntenyTrackRows(ava)
  expect(dotplotAxesFromRows(rows)).toEqual({ y: 'a', x: 'b' })
  expect(dotplotAxesFromRows(rows, true)).toEqual({ y: 'b', x: 'a' })
})
