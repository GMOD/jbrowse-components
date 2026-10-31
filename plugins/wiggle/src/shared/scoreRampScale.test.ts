import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import {
  SCALE_TYPE_LOG,
  denormalizeScore,
} from '@jbrowse/render-core/scoreScale'

import { makeDensityLutFillFn } from './getDensityColor.ts'
import { scoreRampScale } from './scoreRampScale.ts'
import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

// The key's bar and the plot are two drawings of one color function, so a
// score has to land on the same ink in both. `symlogConstant` is the input
// that can separate them: the config slot holds a raw value whose `0` means
// "derive from the domain", and only the renderer's resolution of it is the
// number actually painted with.

const DOMAIN: [number, number] = [0, 1000]
// A heatmap's unset ramp, white at the origin
const HEATMAP_LUT = rampLutOf({ range: ['#2166ac', '#ffffff', '#b2182b'] })
const RAMP = {
  posColor: '#b2182b',
  negColor: '#2166ac',
  cuts: [0],
  innerColors: [],
  rampMid: 0,
}

// A configured constant well away from the auto value this domain derives
// (max/1000 = 1), so a key resolving "auto" paints a visibly different bar.
function makeModel(symlogConstant: number, scheme?: 'viridis') {
  return {
    domain: DOMAIN,
    scaleType: 'symlog',
    symlogConstant,
    renderingType: 'density',
    size: 2,
    lineWidth: 1,
    origin: 0,
    wiggleColor: {
      ...RAMP,
      rampLut: scheme ? rampLutOf({ scheme }) : HEATMAP_LUT,
      rampMid: scheme ? undefined : 0,
    },
  }
}

function renderState(model: ReturnType<typeof makeModel>) {
  return makeWiggleRenderState(model, { width: 800, height: 100, numRows: 1 })
}

function stops(model: ReturnType<typeof makeModel>) {
  return scoreRampScale(
    DOMAIN,
    model.scaleType,
    model.symlogConstant,
    model.wiggleColor,
    'Score',
  ).stops
}

function plotColorAt(model: ReturnType<typeof makeModel>, offset: number) {
  const state = renderState(model)
  const [min, max] = DOMAIN
  return makeDensityLutFillFn(
    min,
    max,
    state.scaleType,
    model.wiggleColor.rampLut,
    model.wiggleColor.rampMid,
    state.symlogConstant,
  )(denormalizeScore(offset, min, max, state.scaleType, state.symlogConstant))
}

test('the ramp is sampled with the constant the plot is painted with', () => {
  const model = makeModel(10)
  const bar = stops(model)
  expect(bar.length).toBeGreaterThan(2)
  for (const stop of bar) {
    expect([stop.offset, stop.color]).toEqual([
      stop.offset,
      plotColorAt(model, stop.offset),
    ])
  }
})

test('and still agrees when the constant is left at the auto default', () => {
  const model = makeModel(0)
  for (const stop of stops(model)) {
    expect(stop.color).toBe(plotColorAt(model, stop.offset))
  }
})

// Named-ramp mode: every stop is verbatim a render LUT entry — the same cached
// bytes the GPU uploads as the density pass's texture and the Canvas2D/SVG
// painter indexes — reached through the same score → t chain the plot paints
// with, so the low end of the domain sits on LUT[0].
test('named-ramp stops are the render LUT entries the plot paints', () => {
  const model = makeModel(10, 'viridis')
  const state = renderState(model)
  const lut = rampLutOf({ scheme: 'viridis' })
  const paint = makeDensityLutFillFn(
    DOMAIN[0],
    DOMAIN[1],
    state.scaleType,
    lut,
    state.rampMid,
    state.symlogConstant,
  )
  const bar = stops(model)
  expect(bar.length).toBeGreaterThan(2)
  for (const stop of bar) {
    expect([stop.offset, stop.color]).toEqual([
      stop.offset,
      paint(
        denormalizeScore(
          stop.offset,
          DOMAIN[0],
          DOMAIN[1],
          state.scaleType,
          state.symlogConstant,
        ),
      ),
    ])
  }
  const last = 255 * 4
  expect(bar[0]!.color).toBe(
    `rgba(${lut[0]},${lut[1]},${lut[2]},${(lut[3]! / 255).toFixed(3)})`,
  )
  expect(bar.at(-1)!.color).toBe(
    `rgba(${lut[last]},${lut[last + 1]},${lut[last + 2]},${(lut[last + 3]! / 255).toFixed(3)})`,
  )
})

// The bar is sampled from the real ramp: the loss end of a 0..6 domain with
// its white at 2 can only reach half saturation, and the key says so rather
// than painting a full-strength blue. A symmetric domain saturates both ends.
test('an off-center middle shows its short side unsaturated', () => {
  const ramp = { rampLut: HEATMAP_LUT, rampMid: 2 }
  const off = scoreRampScale([0, 6], 'linear', 1, ramp, 'Score').stops
  const end = (i: number) =>
    `rgba(${HEATMAP_LUT[i * 4]},${HEATMAP_LUT[i * 4 + 1]},${HEATMAP_LUT[i * 4 + 2]},1.000)`
  expect(off.at(0)!.color).not.toBe(end(0))
  expect(off.at(-1)!.color).toBe(end(255))
  const even = scoreRampScale([0, 4], 'linear', 1, ramp, 'Score').stops
  expect(even.at(0)!.color).toBe(end(0))
  expect(even.at(-1)!.color).toBe(end(255))
})

// The key stands in for the axis, so its middle is the plot's middle: under
// log that is the geometric mean of the domain, not its arithmetic midpoint.
test('a log key puts the geometric mean at its middle', () => {
  const ramp = { rampLut: rampLutOf({ scheme: 'viridis' }), rampMid: undefined }
  const middle = scoreRampScale(
    [1, 10_000],
    'log',
    1,
    ramp,
    'Score',
  ).stops.find(s => s.offset === 0.5)!
  const paint = makeDensityLutFillFn(
    1,
    10_000,
    SCALE_TYPE_LOG,
    ramp.rampLut,
    undefined,
  )
  expect(middle.color).toBe(paint(100))
  expect(middle.color).not.toBe(paint(5000))
})

test('the scale names its domain ends through the score formatter', () => {
  const scale = scoreRampScale(
    [0, 1500],
    'log',
    1,
    { rampLut: HEATMAP_LUT, rampMid: undefined },
    'Score',
  )
  expect(scale.title).toBe('Score (log)')
  expect(scale.domain).toEqual([0, 1500])
  expect(scale.format!(1500)).toBe('1500')
})
