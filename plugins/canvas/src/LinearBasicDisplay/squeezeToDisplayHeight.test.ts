import { createTestEnvironment } from './testEnv.ts'

// State-machine coverage for squeeze-to-display-height mode (the "Fit to
// display height" menu preset). The squeeze arithmetic itself is covered by
// scaleLaidOutData in layout.test.ts; here we only drive the mode flag, scroll
// reset, and the preset-picks-exit-squeeze interplay. With no feature data maxY
// is 0, so squeezeScale stays 1 (a no-op) throughout.
describe('canvas display squeeze-to-display-height', () => {
  it('squeezeScale is 1 and squeeze is off by default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.squeezeToDisplayHeight).toBe(false)
    expect(display.squeezeScale).toBe(1)
  })

  it('entering squeeze mode resets scroll; leaving it leaves scroll alone', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setScrollTop(300)

    display.setSqueezeToDisplayHeight(true)
    expect(display.squeezeToDisplayHeight).toBe(true)
    expect(display.scrollTop).toBe(0)

    display.setScrollTop(120)
    display.setSqueezeToDisplayHeight(false)
    expect(display.squeezeToDisplayHeight).toBe(false)
    expect(display.scrollTop).toBe(120)
  })

  it('setDisplayMode exits squeeze mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSqueezeToDisplayHeight(true)
    display.setDisplayMode('compact')
    expect(display.squeezeToDisplayHeight).toBe(false)
  })

  it('resetDisplayMode exits squeeze mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSqueezeToDisplayHeight(true)
    display.resetDisplayMode()
    expect(display.squeezeToDisplayHeight).toBe(false)
  })

  it('setCompactness exits squeeze mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSqueezeToDisplayHeight(true)
    display.setCompactness('super-compact')
    expect(display.squeezeToDisplayHeight).toBe(false)
  })

  it('entering squeeze mode turns off auto-fit height (opposite intents)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setAutoHeight(true)
    display.setSqueezeToDisplayHeight(true)
    expect(display.squeezeToDisplayHeight).toBe(true)
    expect(display.autoHeight).toBe(false)
  })

  it('enabling auto-fit height exits squeeze mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setSqueezeToDisplayHeight(true)
    display.setAutoHeight(true)
    expect(display.autoHeight).toBe(true)
    expect(display.squeezeToDisplayHeight).toBe(false)
  })
})
