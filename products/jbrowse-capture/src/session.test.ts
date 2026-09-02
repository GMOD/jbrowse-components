import { assemblyFromSession, trackIdsFromSession } from './session.ts'

test('string and object track entries both yield their id', () => {
  expect(
    trackIdsFromSession({
      views: [
        { tracks: ['a', { trackId: 'b', displaySnapshot: { height: 9 } }] },
      ],
    }),
  ).toEqual(['a', 'b'])
})

test('nested views are collected too', () => {
  // a synteny or breakpoint-split spec puts its LGVs one level down, so a
  // top-level-only walk would expect nothing and gate on nothing
  expect(
    trackIdsFromSession({
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['synteny'],
          views: [{ tracks: ['top'] }, { tracks: ['bottom'] }],
        },
      ],
    }),
  ).toEqual(['synteny', 'top', 'bottom'])
})

// The two synteny spellings. A spec's `tracks` may be one string[] per level
// (the shape normalizeTrackLevels accepts), and a session saved from a running
// view carries `levels: [{tracks}]` instead — both used to be filtered out as
// malformed entries, so a synteny --session contributed no expectations and
// the gate passed on an empty browser.
test('per-level track lists in a synteny spec are collected', () => {
  expect(
    trackIdsFromSession({
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [['mat_vs_pat'], ['pat_vs_ref']],
          views: [{}, {}, {}],
        },
      ],
    }),
  ).toEqual(['mat_vs_pat', 'pat_vs_ref'])
})

test("tracks on a snapshot-shaped view's levels are collected", () => {
  expect(
    trackIdsFromSession({
      views: [
        {
          type: 'LinearSyntenyView',
          levels: [{ tracks: [{ trackId: 'synteny' }] }],
          views: [{ tracks: ['genes'] }, {}],
        },
      ],
    }),
  ).toEqual(['synteny', 'genes'])
})

test('a spec with no tracks expects none', () => {
  expect(
    trackIdsFromSession({ views: [{ type: 'LinearGenomeView' }] }),
  ).toEqual([])
  expect(trackIdsFromSession({})).toEqual([])
})

test('the assembly comes from the first view that names one', () => {
  expect(
    assemblyFromSession({
      views: [{ type: 'LinearGenomeView', assembly: 'hg38' }],
    }),
  ).toBe('hg38')
})

test('a nested view supplies the assembly when the outer one does not', () => {
  // a synteny spec names assemblies on its child LGVs, not on itself, so the
  // hub name would otherwise be expected and a correct capture would fail
  expect(
    assemblyFromSession({
      views: [
        {
          type: 'LinearSyntenyView',
          views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
        },
      ],
    }),
  ).toBe('hg38')
})

test('a spec naming no assembly expects none', () => {
  expect(assemblyFromSession({ views: [{ type: 'SpreadsheetView' }] })).toBe(
    undefined,
  )
})
