import { rampLutOf } from '@jbrowse/core/util/colorRamp'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { resolveWiggleColor, wiggleColorEncoding } from './wiggleColor.ts'
import { wiggleColorSchema } from './wiggleColorConfigSchema.ts'

import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

const EMPTY: ColorSetting = {
  value: undefined,
  field: '',
  scale: undefined,
  domain: [],
  range: [],
}

const color = (over: Partial<ColorSetting>) => ({ ...EMPTY, ...over })

const resolved = (written: ColorSetting, origin: number) =>
  resolveWiggleColor(wiggleColorEncoding(written), origin)

test('a bare value paints both sides', () => {
  expect(resolved(color({ value: 'green' }), 0)).toEqual({
    posColor: 'green',
    negColor: 'green',
    pivot: 0,
    cuts: [0],
    innerColors: [],
    rampLut: null,
    perSource: false,
  })
})

test('an empty threshold domain cuts at the origin, in the wiggle defaults', () => {
  expect(resolved(color({ field: 'score' }), 3)).toEqual({
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: WIGGLE_NEG_COLOR_DEFAULT,
    pivot: 3,
    cuts: [3],
    innerColors: [],
    rampLut: null,
    perSource: false,
  })
})

test('each cut after the first adds a band, painted by the next range colour', () => {
  const out = resolved(
    color({
      field: 'score',
      scale: 'threshold',
      domain: ['2', '-2'],
      range: ['blue', 'grey', 'red'],
    }),
    0,
  )
  expect(out).toMatchObject({
    pivot: -2,
    cuts: [-2, 2],
    negColor: 'blue',
    innerColors: ['grey'],
    posColor: 'red',
  })
})

test('a band a threshold range leaves out paints the no-category grey', () => {
  const out = resolved(
    color({ field: 'score', scale: 'threshold', domain: ['-2', '0', '2'] }),
    0,
  )
  expect(out.innerColors).toEqual(['#afafaf', '#afafaf'])
  expect([out.negColor, out.posColor]).toEqual([
    WIGGLE_NEG_COLOR_DEFAULT,
    WIGGLE_POS_COLOR_DEFAULT,
  ])
})

test('a threshold domain names the cut and the range the two sides', () => {
  const out = resolved(
    color({
      field: 'score',
      scale: 'threshold',
      domain: ['2'],
      range: ['#2166ac', '#b2182b'],
    }),
    0,
  )
  expect(out.pivot).toBe(2)
  expect(out.negColor).toBe('#2166ac')
  expect(out.posColor).toBe('#b2182b')
})

test('source through a categorical scale is a colour per source', () => {
  expect(resolved(color({ field: 'source' }), 0).perSource).toBe(true)
})

test('a scheme resolves to the LUT both backends index', () => {
  const out = resolved(
    color({ field: 'score', scale: 'linear', scheme: 'viridis' }),
    0,
  )
  expect(out.rampLut).toEqual(rampLutOf({ scheme: 'viridis' }))
})

// A ramp field named anything else used to become linear because a ramp was
// written; the scale follows the field alone now, and a ramp asks for linear.
test('a range written under an unset scale does not turn score into a ramp', () => {
  const out = resolved(color({ field: 'score', range: ['white', 'red'] }), 0)
  expect(out.rampLut).toBeNull()
  expect([out.negColor, out.posColor]).toEqual(['white', 'red'])
})

test('reverse turns a ramp and its ends round', () => {
  const forward = resolved(
    color({ field: 'score', scale: 'linear', range: ['white', 'red'] }),
    0,
  )
  const reversed = resolved(
    color({
      field: 'score',
      scale: 'linear',
      range: ['white', 'red'],
      reverse: true,
    }),
    0,
  )
  expect([reversed.negColor, reversed.posColor]).toEqual(['red', 'white'])
  expect(reversed.rampLut).not.toBe(forward.rampLut)
  expect([...reversed.rampLut!.slice(0, 4)]).toEqual([
    ...forward.rampLut!.slice(-4),
  ])
})

test("a line under a scheme parts in the scheme's own end colours", () => {
  const out = resolved(
    color({ field: 'score', scale: 'linear', scheme: 'viridis' }),
    0,
  )
  const lut = rampLutOf({ scheme: 'viridis' })
  const last = lut.length - 4
  expect([out.negColor, out.posColor]).toEqual([
    `rgb(${lut[0]},${lut[1]},${lut[2]})`,
    `rgb(${lut[last]},${lut[last + 1]},${lut[last + 2]})`,
  ])
})

test('a linear scale with no range or scheme paints viridis', () => {
  const out = resolved(color({ field: 'score', scale: 'linear' }), 0)
  expect(out.rampLut).toEqual(rampLutOf({ scheme: 'viridis' }))
  expect(
    resolved(color({ field: 'score', scale: 'linear', reverse: true }), 0)
      .rampLut,
  ).toEqual(rampLutOf({ scheme: 'viridis', reverse: true }))
})

test('CSS stops build one cached LUT, and domainMid moves the pivot', () => {
  const written = color({
    field: 'score',
    scale: 'linear',
    range: ['white', 'red'],
    domainMid: 2,
  })
  const out = resolved(written, 0)
  expect(out.pivot).toBe(2)
  expect(out.rampLut).toBe(resolved(written, 0).rampLut)
  expect(out.rampLut).not.toBeNull()
})

test('one CSS stop is a ramp from white to that colour, whatever the origin', () => {
  const written = color({ field: 'score', scale: 'linear', range: ['red'] })
  const out = resolved(written, 3)
  expect(out.rampLut).toBe(rampLutOf({ range: ['white', 'red'] }))
  expect(out.rampMid).toBeUndefined()
  expect(resolved(written, -7).rampLut).toBe(out.rampLut)
  expect([out.posColor, out.negColor]).toEqual(['red', 'red'])
})

test('a ramp takes its transform from the y scale, so log is refused', () => {
  expect(() =>
    wiggleColorSchema.create({ field: 'score', scale: 'log' }),
  ).toThrow()
  expect(
    wiggleColorSchema.create({ field: 'score', scale: 'linear' }).scale,
  ).toBe('linear')
})
