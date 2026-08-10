import { readSessionSummaryInPage } from './sessionGate.ts'

const stub = (session: unknown) => {
  ;(globalThis as { JBrowseSession?: unknown }).JBrowseSession = session
}

afterEach(() => {
  delete (globalThis as { JBrowseSession?: unknown }).JBrowseSession
})

const track = (trackId: string) => ({ configuration: { trackId } })

test('no session on the page reports undefined', () => {
  stub(undefined)
  expect(readSessionSummaryInPage()).toBeUndefined()
})

test('a plain view reports its own tracks', () => {
  stub({ views: [{ assemblyNames: ['hg38'], tracks: [track('genes')] }] })
  expect(readSessionSummaryInPage()).toEqual({
    views: 1,
    assemblies: ['hg38'],
    trackIds: ['genes'],
  })
})

// The bug this file exists to prevent: a LinearSyntenyView keeps its synteny
// tracks on `levels`, one per gap between adjacent rows, and its own `tracks`
// is empty. Reading the top level only reported "tracks []" for a view whose
// ribbons were on screen, so every synteny capture timed out and the error
// blamed the caller's config.
test('a synteny view reports the tracks open on its levels', () => {
  stub({
    views: [
      {
        assemblyNames: ['hg002v1.2'],
        tracks: [],
        levels: [{ tracks: [track('mat_vs_pat')] }],
        views: [
          { assemblyNames: ['hg002v1.2'] },
          { assemblyNames: ['hg002v1.2'] },
        ],
      },
    ],
  })
  expect(readSessionSummaryInPage()).toEqual({
    views: 1,
    assemblies: ['hg002v1.2'],
    trackIds: ['mat_vs_pat'],
  })
})

// The per-row LGV tracks of a container view are one level down too, so a
// top-level-only walk misses those as well.
test('a container view reports the tracks open on its rows', () => {
  stub({
    views: [
      {
        tracks: [],
        levels: [{ tracks: [track('synteny')] }],
        views: [
          { assemblyNames: ['hg38'], tracks: [track('top_genes')] },
          { assemblyNames: ['mm39'], tracks: [track('bottom_genes')] },
        ],
      },
    ],
  })
  expect(readSessionSummaryInPage()).toEqual({
    views: 1,
    assemblies: ['hg38', 'mm39'],
    trackIds: ['synteny', 'top_genes', 'bottom_genes'],
  })
})

test('a track with no configuration is named rather than dropped', () => {
  stub({ views: [{ tracks: [{}] }] })
  expect(readSessionSummaryInPage()?.trackIds).toEqual(['(unnamed)'])
})
