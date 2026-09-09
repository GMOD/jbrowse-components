import { setConf } from '@jbrowse/core/configuration'
import { LEGEND_SVG_GUTTER_WIDTH } from '@jbrowse/core/ui/SvgColorLegend'

import { generateLDColorRamp } from './components/ldColorRamp.ts'
import { createTestEnvironment } from './testEnv.ts'

// The key is the ramp the cells are painted through, so its stops come out of
// the same LUT the GPU samples: a swatch at bar fraction t is byte-identical to
// the ramp entry at t.
test('the scale is the loaded metric, read out of the painting LUT', () => {
  const { display } = createTestEnvironment().createDisplay()
  const [scale] = display.colorScales
  expect(scale).toMatchObject({
    kind: 'ramp',
    id: 'ld',
    title: 'R²',
    domain: [0, 1],
  })
  const lut = generateLDColorRamp('r2')
  const last = scale?.kind === 'ramp' ? scale.stops.at(-1)! : undefined
  expect(last).toMatchObject({ offset: 1 })
  expect(last!.color).toBe(
    `rgb(${lut[lut.length - 4]},${lut[lut.length - 3]},${lut[lut.length - 2]})`,
  )
  expect(display.legendSpec.sections![0]!.items[0]).toMatchObject({
    label: 'R²',
    gradient: { minLabel: '0', maxLabel: '1' },
  })
})

test("a dprime request keys as D'", () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, 'ldMetric', 'dprime')
  expect(display.colorScales[0]!.title).toBe("D'")
})

// The triangle fills its band, so the export parks the key beside it — on the
// setting alone, since the container measures this before any data lands.
test('the export gutter is reserved on the setting, not on the data', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setShowLegend(true)
  expect(display.svgLegendWidth()).toBe(LEGEND_SVG_GUTTER_WIDTH)
  display.setShowLegend(false)
  expect(display.svgLegendWidth()).toBe(0)
})
