import { abgrAlpha, packAbgr } from '@jbrowse/core/util/colorBits'

import { createComparativeColorFunction } from './colorFunctions.ts'
import {
  createOpacityFunction,
  fadedColor,
  opacityFadeOf,
  opacityLevel,
  opacityRangeAt,
} from './opacityChannel.ts'

import type { ColorFunctionInputs } from './colorFunctions.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyOpacitySnapshot } from './syntenyOpacityConfigSchema.ts'

function fadeOf(
  setting: SyntenyOpacitySnapshot,
  attributes: Record<string, Float32Array>,
  fetchRanges: Record<string, AttributeRange> = {},
  viewRanges: Record<string, AttributeRange> = fetchRanges,
) {
  const fade = createOpacityFunction({
    setting,
    attributes,
    viewRanges,
    fetchRanges,
  })
  return (index: number) => fade!(index)
}

describe('the constant', () => {
  test('is the level, the default while unset, and fades nothing', () => {
    expect(opacityLevel({}, 0.2)).toBe(0.2)
    expect(opacityLevel({ value: 0.7 }, 0.2)).toBe(0.7)
    expect(
      createOpacityFunction({
        setting: { value: 0.7 },
        attributes: {},
        viewRanges: {},
        fetchRanges: {},
      }),
    ).toBeUndefined()
  })

  test('a field parked under none draws the constant', () => {
    const setting = { value: 0.4, field: 'identity', scale: 'none' } as const
    expect(opacityLevel(setting, 0.2)).toBe(0.4)
    expect(opacityFadeOf(setting)).toBeUndefined()
  })
})

describe('a number field', () => {
  const attributes = { identity: new Float32Array([0, 0.5, 1, Number.NaN]) }

  test('fades from 0.3 to 1 across the measurement, as shares of the level', () => {
    const fade = fadeOf({ field: 'identity' }, attributes)
    expect(opacityLevel({ field: 'identity' }, 0.2)).toBe(1)
    expect(fade(0)).toBeCloseTo(0.3)
    expect(fade(1)).toBeCloseTo(0.65)
    expect(fade(2)).toBeCloseTo(1)
    // no value draws at the level
    expect(fade(3)).toBe(1)
  })

  test('a written range is the opacities themselves, the level its top', () => {
    const setting = { field: 'identity', range: ['0.1', '0.4'] }
    expect(opacityLevel(setting, 0.2)).toBe(0.4)
    const fade = fadeOf(setting, attributes)
    expect(fade(0) * 0.4).toBeCloseTo(0.1)
    expect(fade(2) * 0.4).toBeCloseTo(0.4)
  })

  test('a one-entry range draws every value at that opacity', () => {
    const setting = { field: 'identity', range: ['0.5'] }
    expect(opacityLevel(setting, 0.2)).toBe(0.5)
    const fade = fadeOf(setting, attributes)
    expect(fade(0)).toBe(1)
    expect(fade(2)).toBe(1)
  })

  test('pinned ends clamp the values past them', () => {
    const fade = fadeOf(
      { field: 'identity', domainMin: 0.9, domainMax: 1 },
      { identity: new Float32Array([0.5, 0.95]) },
    )
    expect(fade(0)).toBeCloseTo(0.3)
    expect(fade(1)).toBeCloseTo(0.65)
  })

  test('a preset reads its own lane', () => {
    const fade = fadeOf(
      { field: 'mapq' },
      { mappingQual: new Float32Array([0, 60]) },
    )
    expect(fade(0)).toBeCloseTo(0.3)
    expect(fade(1)).toBeCloseTo(1)
  })

  test("a column spans the view's accumulated range, not the fetch's", () => {
    const fade = fadeOf(
      { field: 'dn' },
      { dn: new Float32Array([5]) },
      { dn: { min: 5, max: 5 } },
      { dn: { min: 0, max: 10 } },
    )
    expect(fade(0)).toBeCloseTo(0.65)
  })
})

// odp draws an ortholog on a significantly paired chromosome pair at 0.8 and
// the rest at 0.15
test('a threshold takes one opacity per interval, a value on a cut the one above', () => {
  const setting = {
    field: 'break_FET',
    scale: 'threshold',
    domain: ['0.05'],
    range: ['0.8', '0.15'],
  } as const
  expect(opacityLevel(setting, 0.2)).toBe(0.8)
  const fade = fadeOf(setting, {
    break_FET: new Float32Array([0.001, 0.05, 0.4, Number.NaN]),
  })
  expect(fade(0) * 0.8).toBeCloseTo(0.8)
  expect(fade(1) * 0.8).toBeCloseTo(0.15)
  expect(fade(2) * 0.8).toBeCloseTo(0.15)
  expect(fade(3)).toBe(1)
})

test('a text column takes the opacity its label is listed with, opaque unlisted', () => {
  const labels = { labels: ['yes', 'no', 'maybe'], colors: {} }
  const fade = fadeOf(
    { field: 'sig', domain: ['yes', 'no'], range: ['1', '0.2'] },
    { sig: new Float32Array([0, 1, 2, Number.NaN]) },
    { sig: labels },
  )
  expect(fade(0)).toBe(1)
  expect(fade(1)).toBeCloseTo(0.2)
  expect(fade(2)).toBe(1)
  expect(fade(3)).toBe(1)
})

// the slider scales a field's range at both ends, which has to recolor nothing
test('a range scaled alike at both ends hands the color pass the same fade', () => {
  expect(opacityFadeOf({ field: 'identity', range: ['0.1', '0.5'] })).toEqual(
    opacityFadeOf({ field: 'identity', range: ['0.2', '1'] }),
  )
  expect(opacityFadeOf({ value: 0.3 })).toBeUndefined()
})

test('a text column with no range keeps every label at the new level', () => {
  const setting = { field: 'kind', domain: ['a', 'b'] }
  const ranges = { kind: { labels: ['a', 'b'], colors: {} } }
  expect(opacityRangeAt(setting, 0.6, ranges)).toEqual(['0.6', '0.6'])
})

describe('the color pass', () => {
  const data: ColorFunctionInputs = {
    strands: new Int8Array([1, 1]),
    refNameDict: [],
    refNameIds: new Uint32Array(2),
    mateRefNameDict: [],
    mateRefNameIds: new Uint32Array(2),
    attributes: { identity: new Float32Array([0, 1]) },
    attributeRanges: {},
  }

  test('fades each color by its share, whatever the color field', () => {
    const color = createComparativeColorFunction({
      field: 'strand',
      data,
      trackColor: 'red',
      defaultColor: 0,
      attributeRanges: {},
      opacity: { field: 'identity' },
    })
    expect(abgrAlpha(color(0))).toBe(Math.round(0.3 * 255))
    expect(abgrAlpha(color(1))).toBe(255)
  })

  test("multiplies the color's own alpha rather than replacing it", () => {
    expect(abgrAlpha(fadedColor(packAbgr(0, 0, 0, 128), 0.5))).toBe(64)
    expect(abgrAlpha(fadedColor(packAbgr(0, 0, 0, 0), 0.5))).toBe(0)
  })
})
