import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

// The genotype matrix is a sticky canvas, so when the content moves and the
// pointer doesn't there is no `mousemove` and no `mouseleave` to fire.
// The chrome's pointer measurement clears the hover on the axis where the
// *pointer* moved and on nothing else, so a stored `hoveredGenotype` outlives a
// pan, a zoom and an internal scroll — and the tooltip then reports one
// sample's genotype while the cursor sits over another's.
//
// `scrollTop` is the worst of the three here: the rows move but the tooltip is
// placed from the pointer, so the two visibly separate. Tested on the base
// model, via the regular display's harness, because both multi-sample variant
// displays get the hover state and the fix from it.
//
// See `installClearHoverOnViewportChange` and ARCHITECTURE.md "Don't **store** a
// hover without clearing it on viewport change".
const HOVER = { genotype: '0|1', name: 'HG002' }

function hovering() {
  const { display, view } = createTestEnvironment().createDisplay()
  display.setHoveredGenotype(HOVER)
  expect(display.hoveredGenotype).toBeDefined()
  return { display, view }
}

// The cross-display hook `LinearGenomeViewContainer` publishes to
// `session.hovered`. It is what makes that read total: the container asks every
// display the same question, and this display's answer is its genotype cell.
test('the genotype hover fills BaseDisplay hoveredFeature', () => {
  const { display } = hovering()
  expect(display.hoveredFeature).toEqual(HOVER)
  display.setHoveredGenotype(undefined)
  expect(display.hoveredFeature).toBeUndefined()
})

test('a zoom clears the hover', () => {
  const { display, view } = hovering()
  view.zoomTo(view.bpPerPx * 2)
  expect(display.hoveredGenotype).toBeUndefined()
})

test('a pan clears the hover, with no zoom change', () => {
  const { display, view } = hovering()
  const { bpPerPx } = view
  view.horizontalScroll(100)
  expect(view.bpPerPx).toBe(bpPerPx)
  expect(display.hoveredGenotype).toBeUndefined()
})

// `setScrollTop` is clamped against `scrollableHeight`, which is 0 in
// fit-to-height mode by construction (the rows are sized to the viewport, so
// this display genuinely cannot scroll there). Pinning a row height taller than
// the viewport can hold is what gives the axis somewhere to move.
test('the rows scrolling under the cursor clears the hover', () => {
  const { display } = hovering()
  display.setSources(Array.from({ length: 40 }, (_, i) => ({ name: `HG${i}` })))
  display.setRowHeight(50)
  expect(display.scrollableHeight).toBeGreaterThan(0)

  display.setScrollTop(40)
  expect(display.scrollTop).toBe(40)
  expect(display.hoveredGenotype).toBeUndefined()
})

// The reaction reads hover state in its effect to skip a no-op clear. As an
// autorun that read would be a dependency, so setting a hover would re-fire the
// body and clear it again immediately.
test('setting a hover does not clear it', () => {
  const { display } = hovering()
  expect(display.hoveredGenotype).toEqual(HOVER)
})
