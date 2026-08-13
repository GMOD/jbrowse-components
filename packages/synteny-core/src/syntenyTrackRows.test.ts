import {
  dotplotAxesFromRows,
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'
import { assemblyManager, loadingAssemblyManager, track } from './testUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

jest.mock('@jbrowse/core/configuration', () => ({
  readConfObject: (t: { configuration: { assemblyNames: string[] } }) =>
    t.configuration.assemblyNames,
}))

const cross = track('cross', 'SyntenyTrack', ['a', 'b'])
const ava = track('ava', 'SyntenyTrack', ['a', 'b', 'c', 'd'])
const selfA = track('selfA', 'SyntenyTrack', ['a', 'a'])
const lone = track('lone', 'SyntenyTrack', ['a'])
const feature = track('feature', 'FeatureTrack', ['a', 'b'])

const rows = (t: AnyConfigurationModel) => syntenyTrackRows(t, assemblyManager)

test('a pairwise track fills two rows', () => {
  expect(rows(cross)).toEqual(['a', 'b'])
})

test('an all-vs-all track stacks every assembly it names', () => {
  expect(rows(ava)).toEqual(['a', 'b', 'c', 'd'])
})

test('a self-alignment track keeps its repeated assembly', () => {
  expect(rows(selfA)).toEqual(['a', 'a'])
})

// These rows are handed to an AssemblySelector, whose options are the session's
// own names — an alias is a value matching no option, and renders empty.
test('a row is the assembly the track names, not the alias it names it by', () => {
  expect(rows(track('aliased', 'SyntenyTrack', ['aliasOfA', 'b']))).toEqual([
    'a',
    'b',
  ])
})

// a half-written config pads assemblyNames; the padding is not a row
test('an empty assembly name is not a row', () => {
  expect(rows(track('padded', 'SyntenyTrack', ['a', '']))).toEqual(['a'])
})

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

// screened on the rows, so the alias resolves before `has` sees it — the row
// this track opens is 'a', which the session has
test('quick start offers a track that names an assembly by an alias', () => {
  const aliased = track('aliased', 'SyntenyTrack', ['aliasOfA', 'b'])
  expect(quickStart([aliased])).toEqual([aliased])
})

// screened on the rows, so the padding cannot be the second one: this track
// implies a single-row view, which no comparative view can open
test('quick start omits a track padded to two names by an empty one', () => {
  expect(quickStart([track('padded', 'SyntenyTrack', ['a', ''])])).toEqual([])
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
  expect(quickStartSyntenyTracks([cross], loadingAssemblyManager)).toEqual([
    cross,
  ])
})

// This mapping has been written backwards more than once. assemblyNames is
// [query, target] and the dotplot's assembly1/assembly2 are (y, x), so the query
// goes on y. If this test fails, the mapping was flipped — check
// dotplotAxesFromRows' comment before "fixing" the expectation.
test('the query (first assembly) goes on the y-axis, the target on x', () => {
  expect(dotplotAxesFromRows(rows(cross))).toEqual({
    y: 'a',
    x: 'b',
  })
})

test('Swap puts each assembly on the other axis', () => {
  expect(dotplotAxesFromRows(rows(cross), true)).toEqual({
    y: 'b',
    x: 'a',
  })
})

// Swap used to be applied by reversing the row list, which for this track means
// ['d','c','b','a'] and so plots (c, d) rather than transposing (a, b).
test('Swap on an all-vs-all track transposes its pair, not which pair', () => {
  const avaRows = rows(ava)
  expect(dotplotAxesFromRows(avaRows)).toEqual({ y: 'a', x: 'b' })
  expect(dotplotAxesFromRows(avaRows, true)).toEqual({ y: 'b', x: 'a' })
})
