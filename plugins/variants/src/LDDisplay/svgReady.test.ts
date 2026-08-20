import { createTestEnvironment } from './testEnv.ts'

// `renderDisplaySvg` opens with `awaitSvgReady`, an unbounded
// `when(() => model.svgReady)`. So every state a display can rest in
// indefinitely has to be terminal for `svgReady`, or one track hangs the whole
// view's SVG export with the dialog spinner up and nothing said.
//
// LD has such a state: with the triangle toggled off `prepare` declines
// forever, so `rpcData` stays null and `dataCurrent` never flips. That is the
// same shape the sequence display's `fetchInert` exists for.
describe('LD svgReady terminal states', () => {
  it('does not resolve on a loaded-nothing triangle-on display', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.showLDTriangle).toBe(true)
    expect(display.svgReady).toBe(false)
  })

  it('resolves with the triangle toggled off, which never fetches', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setShowLDTriangle(false)
    expect(display.rendersCanvas).toBe(false)
    expect(display.svgReady).toBe(true)
  })
})
