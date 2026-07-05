import { createTestEnvironment } from './testEnv.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'

// Overlapping features so the packer stacks them into rows taller than the
// track height, giving the squeeze something to shrink.
function stackedRegionData(rows: number, heightPx: number) {
  const features = Array.from({ length: rows }, (_, i) => ({
    featureId: `f${i}`,
    startBp: 100,
    endBp: 500,
    height: heightPx,
  }))
  return makeFeatureData({
    flatbushItems: features.map(f =>
      makeFlatbushItem({
        featureId: f.featureId,
        type: 'feature',
        startBp: f.startBp,
        endBp: f.endBp,
        bottomPx: f.height,
        featureHeightPx: f.height,
      }),
    ),
    rectPositions: new Uint32Array(
      features.flatMap(f => [f.startBp, f.endBp]),
    ),
    rectYs: new Float32Array(features.length),
    rectHeights: new Float32Array(features.map(f => f.height)),
    rectColors: new Uint32Array(features.length),
    rectStrands: new Float32Array(features.length),
    rectDensityFade: new Uint32Array(features.length),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
  })
}

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

  it('squeezed content fits the track exactly (no float-epsilon overflow)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    display.setRpcData(0, stackedRegionData(12, 20), view.bpPerPx, {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: 10_000,
    })
    // Height above MIN_FIT_HEIGHT (so the fitHeight floor doesn't confound
    // canExpand) and chosen so base(355)*(97/355) rounds just ABOVE 97 in
    // float — the exact case the clamp guards. Content stacks well past it, so
    // the base layout overflows.
    display.setHeight(97)
    expect(display.baseLaidOutDataMap.size).toBeGreaterThan(0)
    expect(display.squeezeScale).toBe(1)
    expect(display.hasOverflow).toBe(true)

    display.setSqueezeToDisplayHeight(true)
    // Squeeze scales content to fit; maxY must land exactly on height, so the
    // expand button, overflow flag, and scrollbar all stay off.
    expect(display.squeezeScale).toBeLessThan(1)
    expect(display.maxY).toBe(display.height)
    expect(display.hasOverflow).toBe(false)
    expect(display.scrollableHeight).toBe(0)
    expect(display.canExpand).toBe(false)
  })

  it('entering squeeze mode clears a stale expand/restore marker', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setHeight(30)
    display.expandToFit()
    expect(display.heightBeforeExpand).toBe(30)

    display.setSqueezeToDisplayHeight(true)
    expect(display.heightBeforeExpand).toBeUndefined()
  })
})
