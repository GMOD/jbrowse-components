import { createTestEnvironment } from './testEnv.ts'

// HiC holds two content widths and read both off the view directly, which is
// silent for as long as they agree — and they agree until the view is scrolled
// past an end, where `dynamicBlocks` adds the boundary padding blocks that
// `totalWidthPx` counts and `totalWidthPxWithoutBorders` does not.
describe('the HiC canvas box', () => {
  it('is the width renderState sizes the backing store to', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.renderState.canvasWidth).toBe(display.canvasWidth)
  })

  // The triangle's base is the other one, deliberately: the canvas covers the
  // padding blocks, the apex height is set by the span the worker can put
  // contacts on. Unifying them shortens fit-to-height at either end of a
  // contig.
  it('counts the boundary padding the triangle base does not', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.scrollTo(-200)

    expect(view.totalWidthPx).toBeGreaterThan(view.totalWidthPxWithoutBorders)
    expect(display.canvasWidth).toBe(view.totalWidthPx)
    expect(display.renderState.canvasWidth).toBeGreaterThan(
      view.totalWidthPxWithoutBorders,
    )
  })
})
