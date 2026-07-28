import { createTestEnvironment } from './testEnv.ts'

// Getter-level cascade coverage for the two promotable wiggle slots. The
// existing wiggleSizeSlots.test.ts asserts the cascade itself, through
// `resolveConf` on a synthetic display — it would still pass if the real
// display's getter went back to a raw `getConf`.
//
// That matters here because the wiggle display factory takes a widened
// `AnyConfigurationSchemaType`, so its slot reads type as `any` and the
// compile-time guard against a raw read doesn't apply. Reading through
// `WiggleScoreConfigMixin`'s real getters is what catches it: a raw read returns
// the `undefined` inherit sentinel instead of the promoted value.
describe('promotable wiggle slots resolve through the display getter', () => {
  it('scatterPointSize follows a session-wide default, and a track can pin the base back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.scatterPointSize).toBe(2)

    session.setDisplayTypeDefault(display.type, 'scatterPointSize', 5)
    expect(display.scatterPointSize).toBe(5)

    display.setScatterPointSize(2)
    expect(display.scatterPointSize).toBe(2)
  })

  it('lineWidth follows a session-wide default, and a track can pin the base back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.lineWidth).toBe(1)

    session.setDisplayTypeDefault(display.type, 'lineWidth', 4)
    expect(display.lineWidth).toBe(4)

    display.setLineWidth(1)
    expect(display.lineWidth).toBe(1)
  })
})
