import {
  readInstrumentationInPage,
  readSessionSummaryInPage,
} from './sessionGate.ts'

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

// The published AbstractViewModel spelling of the same containers. A view
// implementing the contract without a `levels` prop was invisible here while
// the busy walk in waits.ts (which read only `trackContainers`) saw it — the
// two walkers each covered one spelling. Both now read the contract first and
// fall back, and reading one or the other keeps a live synteny view, which
// carries both, from being counted twice.
test('a view publishing only the trackContainers contract reports its tracks', () => {
  stub({
    views: [
      {
        tracks: [],
        trackContainers: [{ tracks: [track('mat_vs_pat')] }],
      },
    ],
  })
  expect(readSessionSummaryInPage()?.trackIds).toEqual(['mat_vs_pat'])
})

test('a view carrying both spellings is not double-counted', () => {
  const containers = [{ tracks: [track('synteny')] }]
  stub({
    views: [{ tracks: [], trackContainers: containers, levels: containers }],
  })
  expect(readSessionSummaryInPage()?.trackIds).toEqual(['synteny'])
})

test('a track with no configuration is named rather than dropped', () => {
  stub({ views: [{ tracks: [{}] }] })
  expect(readSessionSummaryInPage()?.trackIds).toEqual(['(unnamed)'])
})

// The other half of "what can this build be asked". Every wait keyed on these
// attributes passes when the selector is ABSENT, so a build publishing none of
// them satisfies all of them while it has drawn nothing — measured on
// jbrowse.org/code/jb2/latest, which publishes none of the three. This probe is
// what lets a caller tell that apart from "everything finished".
test('an instrumented page reports each attribute family it publishes', () => {
  document.body.innerHTML = `
    <div data-view-phase="ready">
      <div data-display-phase="ready" data-display-drawn="true"></div>
    </div>`
  expect(readInstrumentationInPage()).toEqual({
    viewPhase: true,
    displayPhase: true,
    displayDrawn: true,
  })
})

test('a released build publishing none of them reports all three false', () => {
  // what the hosted app's DOM looks like: an app, a display, no contract
  document.body.innerHTML = `
    <div data-testid="view-container-lgv">
      <div data-testid="pileup-display"></div>
    </div>`
  expect(readInstrumentationInPage()).toEqual({
    viewPhase: false,
    displayPhase: false,
    displayDrawn: false,
  })
})

// Presence is the question, never the value: `data-display-phase="loading"` is a
// build that CAN be asked, answering "not yet". That is the opposite of a build
// that cannot be asked at all, and reading the value here would conflate them.
test('an attribute mid-flight still counts as published', () => {
  document.body.innerHTML = '<div data-display-phase="loading"></div>'
  expect(readInstrumentationInPage().displayPhase).toBe(true)
})
