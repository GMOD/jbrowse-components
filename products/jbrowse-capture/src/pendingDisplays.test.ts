import {
  describePendingDisplays,
  pendingDisplayStatesInPage,
} from './sessionGate.ts'

afterEach(() => {
  document.body.replaceChildren()
})

// What a timed-out capture says. The stage name alone names the QUESTION — "a
// display never reported its first paint" — and reads identically however it was
// caused, which is the whole reason a timeout was unattributable. The phase each
// unpainted display publishes is the answer.

test('an unpainted display is reported with its phase and instance id', () => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-id="reads-x"
         data-display-drawn="false" data-display-phase="loading"></div>`
  expect(pendingDisplayStatesInPage()).toEqual([
    { name: 'pileup', id: 'reads-x', phase: 'loading' },
  ])
})

test('a painted display is not in the census', () => {
  document.body.innerHTML = `
    <div data-testid="pileup" data-display-drawn="true"
         data-display-phase="ready"></div>`
  expect(pendingDisplayStatesInPage()).toEqual([])
})

// The comparative canvases publish both attributes now. Before they published
// only `data-display-drawn`, so a timeout on one of those pages could say which
// canvas and nothing about why.
test('a shared canvas reports the phase beside its paint flag', () => {
  document.body.innerHTML = `
    <canvas data-testid="synteny_canvas" data-display-drawn="false"
            data-display-phase="error"></canvas>`
  expect(pendingDisplayStatesInPage()).toEqual([
    { name: 'synteny_canvas', id: undefined, phase: 'error' },
  ])
})

// A build older than the attribute. Absent is not `ready` — saying so would
// invent an answer the page never gave.
test('a display publishing no phase is reported as unpublished', () => {
  document.body.innerHTML =
    '<div data-testid="old" data-display-drawn="false"></div>'
  expect(describePendingDisplays(pendingDisplayStatesInPage())).toBe(
    'old is in an unpublished phase',
  )
})

// The case a longer timeout never fixes, and the reason the phase is worth
// carrying at all: the display says it finished and reports no paint, which is
// a bug in the display rather than a slow page.
test('a ready-but-unpainted display is named as such', () => {
  document.body.innerHTML = `
    <div data-testid="dotplot_webgl_canvas" data-display-drawn="false"
         data-display-phase="ready"></div>
    <div data-testid="pileup" data-display-drawn="false"
         data-display-phase="loading"></div>`
  expect(describePendingDisplays(pendingDisplayStatesInPage())).toBe(
    'dotplot_webgl_canvas is ready; pileup is loading',
  )
})
