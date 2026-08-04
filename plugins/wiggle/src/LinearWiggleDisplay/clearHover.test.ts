import { createTestEnvironment } from './testEnv.ts'

import type { WiggleFeatureUnderMouse } from '../util.ts'

// The plot is a painted canvas with nothing travelling with its features, so
// when the content moves under a stationary cursor the browser fires neither
// mousemove nor mouseleave — the model has to drop the hover itself, or the
// tooltip keeps reporting the bp and score the cursor *was* over. Both axes are
// pinned because a locstring or side-scroll pan moves offsetPx without touching
// bpPerPx, which is exactly the case a zoom-only guard misses.
const hover: WiggleFeatureUnderMouse = {
  refName: 'ctgA',
  start: 100,
  end: 101,
  rows: [{ score: 42 }],
}

describe('LinearWiggleDisplay clears its hover when the content moves', () => {
  it('clears on a pan that changes offsetPx alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hover)
    expect(display.featureUnderMouse).toBeDefined()

    view.scrollTo(view.offsetPx + 100)

    expect(display.featureUnderMouse).toBeUndefined()
  })

  it('clears on a zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hover)
    expect(display.featureUnderMouse).toBeDefined()

    view.zoomTo(view.bpPerPx * 2)

    expect(display.featureUnderMouse).toBeUndefined()
  })

  it('leaves the hover alone while the viewport is still', () => {
    // the reaction skips its initial run, so merely setting a hover must not
    // clear it — as an autorun reading hover state it would have
    const { display } = createTestEnvironment().createDisplay()
    display.setFeatureUnderMouse(hover)
    expect(display.featureUnderMouse).toBeDefined()
  })
})
