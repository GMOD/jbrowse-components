import { createTestEnvironment } from './testEnv.ts'

// `renderDisplaySvg` opens with `awaitSvgReady`, an unbounded
// `when(() => model.svgReady)`. So every state a display can rest in
// indefinitely has to be terminal for `svgReady`, or one track hangs the whole
// view's SVG export with the dialog spinner up and nothing said.
describe('LD svgReady terminal states', () => {
  it('does not resolve on a display that has loaded nothing', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.svgReady).toBe(false)
  })

  // a user cancel is durable until Retry or a viewport change, and an export
  // causes neither. Terminal here so the wait is bounded; `awaitSvgReady` then
  // fails the export loudly on the flag
  it('resolves on a standing user cancel instead of hanging the export', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.cancelFetchByUser()
    expect(display.fetchCanceled).toBe(true)
    expect(display.svgReady).toBe(true)
  })
})
