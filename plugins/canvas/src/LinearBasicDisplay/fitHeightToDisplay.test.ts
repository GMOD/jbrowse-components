import { createTestEnvironment } from './testEnv.ts'

// State-machine coverage for "fit to display height". The squeeze arithmetic
// itself is covered by scaleLaidOutData in layout.test.ts; here we only drive
// the mode flag, scroll reset, and the preset-picks-exit-fit interplay. With no
// feature data maxY is 0, so fitScale stays 1 (a no-op) throughout.
describe('canvas display fit-to-display-height', () => {
  it('fitScale is 1 and fit is off by default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.fitScale).toBe(1)
  })

  it('entering fit mode resets scroll; leaving it leaves scroll alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setScrollTop(300)

    display.setFitHeightToDisplay(true)
    expect(display.fitHeightToDisplay).toBe(true)
    expect(display.scrollTop).toBe(0)

    display.setScrollTop(120)
    display.setFitHeightToDisplay(false)
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.scrollTop).toBe(120)
  })

  it('setDisplayMode exits fit mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setDisplayMode('compact')
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('resetDisplayMode exits fit mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.resetDisplayMode()
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('setCompactness exits fit mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setCompactness('super-compact')
    expect(display.fitHeightToDisplay).toBe(false)
  })
})
