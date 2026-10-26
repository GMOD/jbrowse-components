import { setConf } from '@jbrowse/core/configuration'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

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
  const lut = display.colorRamp
  const last = scale?.kind === 'ramp' ? scale.stops.at(-1)! : undefined
  expect(last).toMatchObject({ offset: 1 })
  expect(last!.color).toBe(
    `rgb(${lut[lut.length - 4]},${lut[lut.length - 3]},${lut[lut.length - 2]})`,
  )
  expect(display.legendSpec.sections[0]!.items[0]).toMatchObject({
    label: 'R²',
    gradient: { minLabel: '0', maxLabel: '1' },
  })
})

test("a dprime request keys as D'", () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color', 'field'], 'dprime')
  expect(display.colorScales[0]!.title).toBe("D'")
})

// Every value past a pinned end paints that end's color, so the key says so.
test('an end pinned inside 0 to 1 keys as at-most or at-least', () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color'], {
    scale: { domainMin: 0.2, domainMax: 0.8 },
  })
  expect(display.legendSpec.sections[0]!.items[0]).toMatchObject({
    gradient: { minLabel: '≤0.2', maxLabel: '≥0.8' },
  })
})

// equal distances from the middle take equal colors on the GPU, Canvas2D and
// the key alike, so all three read one number
test('domainMid moves the ramp middle on every surface', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.renderState.color.midNorm).toBe(0.5)
  setConf(display, ['encoding', 'color', 'scale', 'domainMid'], 0.25)
  expect(display.renderState.color.midNorm).toBe(0.25)
  expect(display.colorScales[0]).toMatchObject({
    stops: stopsFromRampLut(display.colorRamp, 11, 0.25),
  })
})

test('legend.title replaces the metric name, and "" draws none', () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, ['encoding', 'color', 'legend', 'title'], 'Linkage')
  expect(display.colorScales[0]!.title).toBe('Linkage')
  setConf(display, ['encoding', 'color', 'legend', 'title'], '')
  expect(display.colorScales[0]!.title).toBe('')
})
