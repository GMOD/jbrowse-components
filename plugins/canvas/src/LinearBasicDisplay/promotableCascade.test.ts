import { createTestEnvironment } from './testEnv.ts'

// This display's factory takes a widened schema type, so `getConf` types as
// `any` here and a forgotten `resolveConf` is not a type error; reading
// through the resolved getter is what catches it.
describe('promotable slots resolve through the display getter', () => {
  it('heightMode follows a session-wide default, and a track can pin the base back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.heightMode).toBe('fixed')

    session.setDisplayTypeDefault(display.type, 'heightMode', 'grow')
    expect(display.heightMode).toBe('grow')
    expect(display.autoHeight).toBe(true)

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
