import { createTestEnvironment } from './testEnv.ts'

// Getter-level cascade coverage for the promotable slots that have no menu test
// of their own (`displayMode` has featureHeightMenu.test.ts, `subfeatureLabels`
// has subfeatureLabelsMenu.test.ts).
//
// This display's factory takes a widened `AnyConfigurationSchemaType`, so every
// `getConf(self, ...)` in it types as `any` — the compile-time backstop that
// makes a forgotten `resolveConf` a type error ("raw read is `T | undefined`,
// which won't assign to `T`") does not apply here. Reading the resolved value
// through the real display getter is what catches it instead: a getter that went
// back to a raw read would return the `undefined` inherit sentinel rather than
// the promoted value.
describe('promotable slots resolve through the display getter', () => {
  it('heightMode follows a session-wide default, and a track can pin the base back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.heightMode).toBe('fixed')

    session.setDisplayTypeDefault(display.type, 'heightMode', 'grow')
    expect(display.heightMode).toBe('grow')
    // the derived flags read off the same slot, so they move with it
    expect(display.autoHeight).toBe(true)

    // `fixed` is the base, and still customizable over an opposite default —
    // that is the whole point of spending only the unset state on the sentinel
    display.setHeightMode('fixed')
    expect(display.heightMode).toBe('fixed')
    expect(display.autoHeight).toBe(false)
  })

  it('displayDirectionalChevrons follows a session-wide default, and a track can pin the base back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.displayDirectionalChevrons).toBe(true)

    session.setDisplayTypeDefault(
      display.type,
      'displayDirectionalChevrons',
      false,
    )
    expect(display.displayDirectionalChevrons).toBe(false)

    display.setDisplayDirectionalChevrons(true)
    expect(display.displayDirectionalChevrons).toBe(true)
  })
})
