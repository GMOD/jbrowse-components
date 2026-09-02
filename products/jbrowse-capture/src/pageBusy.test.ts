import { BUSY_SELECTOR, isPageBusyInPage } from './waits.ts'

const stubSession = (session: unknown) => {
  ;(globalThis as { JBrowseSession?: unknown }).JBrowseSession = session
}

afterEach(() => {
  delete (globalThis as { JBrowseSession?: unknown }).JBrowseSession
  document.body.replaceChildren()
})

// The gate for a build with no readiness attributes. Every signal is something
// a component publishes on purpose — no text matching, no computed styles — so
// restyling or rewording the UI cannot move the answer.
test('an idle page with nothing happening is not busy', () => {
  document.body.innerHTML = '<div>chr1</div>'
  expect(isPageBusyInPage()).toBe(false)
})

test.each([
  ['the view-level scrim', '<div data-testid="loading-overlay"></div>'],
  ['a LoadingEllipses label', '<p data-busy="true">Loading features</p>'],
  ['a display mid-fetch', '<div data-display-phase="loading"></div>'],
  ['a view resolving its assembly', '<div data-view-phase="loading"></div>'],
])('%s is busy', (_name, html) => {
  document.body.innerHTML = html
  expect(isPageBusyInPage()).toBe(true)
})

// A display that has finished publishes the same attribute with another value,
// so the selector has to name the value rather than the attribute.
test('a display that reports ready is not busy', () => {
  document.body.innerHTML = '<div data-display-phase="ready"></div>'
  expect(isPageBusyInPage()).toBe(false)
})

// The one signal that is not DOM: on a build with no readiness attributes this
// is all that is left, and it is what the released app was measured using
// ("Downloading features").
test("a display's own status message is busy", () => {
  stubSession({
    views: [{ tracks: [{ displays: [{ message: 'Downloading features' }] }] }],
  })
  expect(isPageBusyInPage()).toBe(true)
})

test('an empty status message is not busy', () => {
  stubSession({ views: [{ tracks: [{ displays: [{ message: '' }] }] }] })
  expect(isPageBusyInPage()).toBe(false)
})

// A container view keeps its displays a level down, the same shape the session
// gate walks for tracks.
test('a sub-view display is reached', () => {
  stubSession({
    views: [
      { views: [{ tracks: [{ displays: [{ message: 'Rendering' }] }] }] },
    ],
  })
  expect(isPageBusyInPage()).toBe(true)
})

// Prose that merely says "loading" is not a status: the old text scan counted
// it, an attribute cannot.
test('text about loading is not busy', () => {
  document.body.innerHTML =
    '<p>Loading a track from a URL is described below.</p>'
  expect(isPageBusyInPage()).toBe(false)
})

// The exported selector and the in-page function have to name the same things,
// or a caller filtering by one gets a different answer than the wait.
test('the exported selector matches what the predicate looks for', () => {
  for (const html of [
    '<div data-testid="loading-overlay"></div>',
    '<p data-busy="true">Loading</p>',
    '<div data-display-phase="loading"></div>',
    '<div data-view-phase="loading"></div>',
  ]) {
    document.body.innerHTML = html
    expect(document.querySelector(BUSY_SELECTOR)).not.toBeNull()
    expect(isPageBusyInPage()).toBe(true)
  }
})

// A view whose tracks hang off something else. The synteny view holds one track
// list per level and none of its own, so a walk of `view.tracks` alone found
// nothing that could be busy — the same hole `AppReadyMarker` had, in the
// fallback path that has no attributes to fall back on.
test("a display in a view's own track container is busy", () => {
  stubSession({
    views: [
      {
        tracks: [],
        trackContainers: [
          {
            tracks: [{ displays: [{ statusMessage: 'Downloading features' }] }],
          },
        ],
      },
    ],
  })
  expect(isPageBusyInPage()).toBe(true)
})

// The raw prop the same containers hang off on a deployed build older than the
// `trackContainers` getter — the spelling the session gate walks. Each walker
// used to read only one of the two.
test('a display on a levels-only synteny view is busy', () => {
  stubSession({
    views: [
      {
        tracks: [],
        levels: [{ tracks: [{ displays: [{ message: 'Downloading' }] }] }],
      },
    ],
  })
  expect(isPageBusyInPage()).toBe(true)
})
