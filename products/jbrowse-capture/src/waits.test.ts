import { displayById, displayPainted, displaySettled } from './waits.ts'

// The three builders exist so that "this display, painted" is written once
// rather than spelled out at each call site (ADR-065). Their whole output is a
// selector string, and agents_capture.md quotes those strings to say what each
// one waits for — so the doc splices this test rather than copying them.
test('the composite selectors name the type and the readiness separately', () => {
  // #region display-selectors
  // `data-testid` names the display TYPE and never changes; readiness is a
  // separate attribute. "Has the pileup painted" is therefore a conjunction,
  // and these builders write it for you — pass one to `page.waitForSelector`.
  expect(displayPainted('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-drawn="true"]',
  )

  // The stronger one. `drawn` flips on FIRST paint, so a figure that must show
  // data waits on the phase instead — that is the whole fetch, not first paint.
  expect(displaySettled('pileup-display')).toBe(
    '[data-testid="pileup-display"][data-display-phase="ready"]',
  )

  // One display by its config's `displayId`, rather than every display of a type.
  expect(displayById('my_pileup')).toBe('[data-display-id="my_pileup"]')
  // #endregion display-selectors
})

// The suffix convention these replaced (`-done` on the chrome displays, `_done`
// on the two chrome-less canvases) mutated data-testid on first paint, so a
// selector written against the id stopped matching once the display painted.
test('the testid a selector is built from does not carry readiness', () => {
  for (const testid of ['pileup-display', 'synteny_canvas']) {
    expect(displayPainted(testid)).toContain(`[data-testid="${testid}"]`)
    expect(displaySettled(testid)).toContain(`[data-testid="${testid}"]`)
  }
})
