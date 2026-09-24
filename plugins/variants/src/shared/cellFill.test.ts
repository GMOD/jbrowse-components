import { colord } from '@jbrowse/core/util/colord'

import { ALT_HUE, cellFill, shadeByDosage } from './cellFill.ts'
import { NO_CALL_COLOR, REFERENCE_COLOR } from './constants.ts'
import { getAlleleColor } from './drawAlleleCount.ts'

import type * as ColordModuleNs from '@jbrowse/core/util/colord'

type ColordModule = typeof ColordModuleNs

jest.mock('@jbrowse/core/util/colord', () => {
  const actual: ColordModule = jest.requireActual('@jbrowse/core/util/colord')
  return { ...actual, colord: jest.fn(actual.colord) }
})

const hex = (css: string) => colord(css).toHex()

describe('shadeByDosage', () => {
  it('full dosage is the hue itself, by identity', () => {
    expect(shadeByDosage(ALT_HUE, 1)).toBe(ALT_HUE)
    expect(shadeByDosage('#d32f2f', 1)).toBe('#d32f2f')
  })

  it("keeps the default mode's hom and het where they have always been", () => {
    expect(hex(shadeByDosage(ALT_HUE, 1))).toBe(hex('hsl(200,50%,30%)'))
    expect(hex(shadeByDosage(ALT_HUE, 0.5))).toBe(hex('hsl(200,50%,55%)'))
  })

  it('lifts lightness and nothing else, so a class color stays that class', () => {
    const tier = '#d32f2f'
    const het = colord(shadeByDosage(tier, 0.5)).toHsl()
    const hom = colord(tier).toHsl()
    expect(het.h).toBeCloseTo(hom.h, 0)
    expect(het.s).toBeCloseTo(hom.s, 0)
    expect(het.l).toBeGreaterThan(hom.l)
  })

  it('is bounded: no dosage washes a hue past the pale ceiling', () => {
    for (const hue of ['#d32f2f', '#fbc02d', '#9e9e9e', ALT_HUE]) {
      for (const dosage of [0, 0.25, 1 / 3, 0.5, 0.75, 1]) {
        expect(
          colord(shadeByDosage(hue, dosage)).toHsl().l,
        ).toBeLessThanOrEqual(80.5)
      }
    }
  })

  it("keeps a translucent hue's alpha on the het", () => {
    expect(colord(shadeByDosage('rgba(255,0,0,0.3)', 0.5)).alpha()).toBeCloseTo(
      0.3,
      2,
    )
  })

  it('leaves a hue already lighter than the ceiling alone', () => {
    expect(hex(shadeByDosage('hsl(200,50%,90%)', 0))).toBe(
      hex('hsl(200,50%,90%)'),
    )
  })

  it('parses a hue once: the repeat is the memo, not a second parse', () => {
    const parse = jest.mocked(colord)
    const hue = '#123456'
    const first = shadeByDosage(hue, 0.5)
    parse.mockClear()
    expect(shadeByDosage(hue, 0.5)).toBe(first)
    expect(parse).not.toHaveBeenCalled()
  })

  it('keeps the default hom and het hexes', () => {
    expect(hex(shadeByDosage(ALT_HUE, 1))).toBe('#265973')
    expect(shadeByDosage(ALT_HUE, 0.5)).toBe('#539fc6')
  })
})

describe('cellFill', () => {
  it('shading off is the bare hue at any dosage', () => {
    expect(cellFill('#d32f2f', 0.5, false)).toBe('#d32f2f')
    expect(cellFill('#d32f2f', 0.5, true)).not.toBe('#d32f2f')
  })
})

describe('getAlleleColor: dosage over CALLED alleles', () => {
  it('hom ref is the reference fill, hom alt the hue', () => {
    expect(getAlleleColor('0/0')).toBe(REFERENCE_COLOR)
    expect(getAlleleColor('1/1')).toBe(ALT_HUE)
  })

  it('which alt is not on the hue: 1/2 is hom, 0/2 is het', () => {
    expect(getAlleleColor('1/2')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('0/2')).toBe(getAlleleColor('0/1'))
    expect(getAlleleColor('0/2')).not.toBe(getAlleleColor('1/2'))
  })

  it('a wholly uncalled genotype is the no-call category, never a blend', () => {
    expect(getAlleleColor('./.')).toBe(NO_CALL_COLOR)
    expect(getAlleleColor('.')).toBe(NO_CALL_COLOR)
  })

  it('a partial call is its dosage over what was called', () => {
    expect(getAlleleColor('./1')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('./0')).toBe(REFERENCE_COLOR)
    expect(getAlleleColor('./1/1')).toBe(getAlleleColor('1/1'))
    expect(getAlleleColor('./0/1')).toBe(getAlleleColor('0/1'))
  })

  it('ploidy shows: a triploid single alt is paler than a diploid one', () => {
    const third = colord(getAlleleColor('0/0/1')).toHsl().l
    const half = colord(getAlleleColor('0/1')).toHsl().l
    expect(third).toBeGreaterThan(half)
  })

  it('skips the reference cell where the display asked it to', () => {
    expect(getAlleleColor('0/0', false)).toBe('')
    expect(getAlleleColor('0/1', false)).not.toBe('')
  })

  it('takes the override hue, and shades it the same way', () => {
    expect(getAlleleColor('1/1', true, '#d32f2f')).toBe('#d32f2f')
    expect(getAlleleColor('0/1', true, '#d32f2f')).toBe(
      shadeByDosage('#d32f2f', 0.5),
    )
    expect(getAlleleColor('0/1', true, '#d32f2f', false)).toBe('#d32f2f')
  })
})
