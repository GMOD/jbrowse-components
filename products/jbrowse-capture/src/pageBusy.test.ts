import { BUSY_SELECTOR, isPageBusyInPage } from './waits.ts'

afterEach(() => {
  document.body.replaceChildren()
})

// Every signal is something a component publishes on purpose — no text
// matching, no computed styles — so restyling or rewording the UI cannot move
// the answer.
test('an idle page with nothing happening is not busy', () => {
  document.body.innerHTML = '<div>chr1</div>'
  expect(isPageBusyInPage(BUSY_SELECTOR)).toBe(false)
})

test.each([
  ['the view-level scrim', '<div data-testid="loading-overlay"></div>'],
  ['a LoadingEllipses label', '<p data-busy="true">Loading features</p>'],
  ['a display mid-fetch', '<div data-display-phase="loading"></div>'],
  ['a view resolving its assembly', '<div data-view-phase="loading"></div>'],
])('%s is busy', (_name, html) => {
  document.body.innerHTML = html
  expect(isPageBusyInPage(BUSY_SELECTOR)).toBe(true)
})

// A display that has finished publishes the same attribute with another value,
// so the selector has to name the value rather than the attribute.
test('a display that reports ready is not busy', () => {
  document.body.innerHTML = '<div data-display-phase="ready"></div>'
  expect(isPageBusyInPage(BUSY_SELECTOR)).toBe(false)
})

// Prose that merely says "loading" is not a status: the old text scan counted
// it, an attribute cannot.
test('text about loading is not busy', () => {
  document.body.innerHTML =
    '<p>Loading a track from a URL is described below.</p>'
  expect(isPageBusyInPage(BUSY_SELECTOR)).toBe(false)
})
