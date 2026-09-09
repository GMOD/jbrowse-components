import { densityRampLut } from './densityColorRamp.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './getDensityColor.ts'
import { scoreRampScale } from './scoreRampScale.ts'
import { makeWiggleRenderState } from './wiggleComponentUtils.ts'

// The key's bar and the plot are two drawings of one color function, so a
// score has to land on the same ink in both. `symlogConstant` is the input
// that can separate them: the config slot holds a raw value whose `0` means
// "derive from the domain", and only the renderer's resolution of it is the
// number actually painted with. `densityColorRamp` is the other: a named ramp
// swaps the plot onto a LUT, and a key still drawing the default fade
// describes a picture the track no longer paints.

const DOMAIN: [number, number] = [0, 1000]
const RAMP = {
  posColor: '#b2182b',
  negColor: '#2166ac',
  pivot: 0,
}

// A configured constant well away from the auto value this domain derives
// (max/1000 = 1), so a key resolving "auto" paints a visibly different bar.
function makeModel(symlogConstant: number, densityColorRamp = 'default') {
  return {
    domain: DOMAIN,
    scaleType: 'symlog',
    symlogConstant,
    renderingType: 'density',
    scatterPointSize: 2,
    lineWidth: 1,
    bicolorPivot: RAMP.pivot,
    densityColorRamp,
  }
}

function renderState(model: ReturnType<typeof makeModel>) {
  return makeWiggleRenderState(model, { width: 800, height: 100, numRows: 1 })
}

function stops(model: ReturnType<typeof makeModel>) {
  return scoreRampScale(DOMAIN, model.scaleType, model.symlogConstant, {
    ...RAMP,
    rampLut: densityRampLut(model.densityColorRamp),
  }).stops
}

function plotColorAt(model: ReturnType<typeof makeModel>, offset: number) {
  const state = renderState(model)
  const [min, max] = DOMAIN
  return makeDensityRgbStringFn(
    min,
    max,
    state.scaleType,
    178,
    24,
    43,
    state.origin,
    state.symlogConstant,
  )(min + (max - min) * offset)
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
// with, so the pivot end sits on LUT[0].
test('named-ramp stops are the render LUT entries the plot paints', () => {
  const model = makeModel(10, 'viridis')
  const state = renderState(model)
  const lut = densityRampLut('viridis')!
  const paint = makeDensityLutFillFn(
    DOMAIN[0],
    DOMAIN[1],
    state.scaleType,
    lut,
    state.origin,
    state.symlogConstant,
  )
  const bar = stops(model)
  expect(bar.length).toBeGreaterThan(2)
  for (const stop of bar) {
    expect([stop.offset, stop.color]).toEqual([
      stop.offset,
      paint(DOMAIN[0] + (DOMAIN[1] - DOMAIN[0]) * stop.offset),
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

// The bar is sampled from the real ramp: the loss end of a 0..6 domain pivoted
// at 2 can only reach half saturation, and the key says so rather than
// painting a full-strength blue. A symmetric domain saturates both ends.
test('an off-center pivot shows its short side unsaturated', () => {
  const ramp = { ...RAMP, pivot: 2, rampLut: null }
  const off = scoreRampScale([0, 6], 'linear', 1, ramp).stops
  expect(off.at(0)).toEqual({ offset: 0, color: 'rgb(144,178,213)' })
  expect(off.at(-1)).toEqual({ offset: 1, color: 'rgb(178,24,43)' })
  const even = scoreRampScale([0, 4], 'linear', 1, ramp).stops
  expect(even.at(0)!.color).toBe('rgb(33,102,172)')
  expect(even.at(-1)!.color).toBe('rgb(178,24,43)')
})

test('a CSS color the picker writes is parsed, not read as hex', () => {
  const scale = scoreRampScale([0, 4], 'linear', 1, {
    ...RAMP,
    posColor: 'rgb(178, 24, 43)',
    pivot: 2,
    rampLut: null,
  })
  expect(scale.stops.at(-1)!.color).toBe('rgb(178,24,43)')
})

test('the scale names its domain ends through the score formatter', () => {
  const scale = scoreRampScale([0, 1500], 'log', 1, { ...RAMP, rampLut: null })
  expect(scale.title).toBe('Score (log)')
  expect(scale.domain).toEqual([0, 1500])
  expect(scale.format!(1500)).toBe('1500')
})
