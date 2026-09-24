import {
  assemblyFromSession,
  sessionSpecQuery,
  trackIdsFromSession,
} from './session.ts'

test('a config URL with its own query survives the query string', () => {
  const query = sessionSpecQuery({
    config: 'https://example.org/c.json?v=2&x=1',
    session: { views: [{ type: 'LinearGenomeView' }] },
  })
  const params = new URLSearchParams(query.slice(1))
  expect(params.get('config')).toBe('https://example.org/c.json?v=2&x=1')
  expect(params.get('session')).toBe(
    'spec-{"views":[{"type":"LinearGenomeView"}]}',
  )
  expect(params.get('sessionName')).toBe('Screenshot')
})

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

// a spec nests one string[] per level; a saved session carries `levels`
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

// the gate checks one name against the open assemblies, so a list joined into
// one string never matched and a two-genome circle timed out
test("a circle's assembly list supplies its first genome", () => {
  expect(
    assemblyFromSession({
      views: [{ type: 'CircularView', assembly: ['hg38', 'mm39'] }],
    }),
  ).toBe('hg38')
})

test('a spec naming no assembly expects none', () => {
  expect(assemblyFromSession({ views: [{ type: 'SpreadsheetView' }] })).toBe(
    undefined,
  )
})

// "Export session..." writes the live snapshot, which names a track by its
// `configuration` (the trackId, or a session track's whole config) and keeps
// its assembly on the displayed regions
test('a saved snapshot yields its trackIds and assembly', () => {
  const snapshot = {
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [{ assemblyName: 'hg38', refName: 'chr17' }],
        tracks: [
          { type: 'FeatureTrack', configuration: 'hg38-genes' },
          {
            type: 'FeatureTrack',
            configuration: { trackId: 'my-session-track' },
          },
        ],
      },
    ],
  }
  expect(trackIdsFromSession(snapshot)).toEqual([
    'hg38-genes',
    'my-session-track',
  ])
  expect(assemblyFromSession(snapshot)).toBe('hg38')
})
