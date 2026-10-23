import {
  colorForField,
  parkedColorOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import {
  BASE_COLOR_FIELDS,
  COLOR_FIELDS,
  alignmentsColorEncoding,
  baseLayerOf,
  bodyColorScheme,
  pinnedInsertSizeBand,
  readColorFieldOf,
} from './alignmentsColor.ts'
import { colorSchemeOf } from './colorSchemes.ts'
import { colorSettingOf } from './colorSettingFixture.ts'
import { FACET_LABELS } from './facetLabels.ts'

import type { ColorSlots } from '@jbrowse/core/util/colorScale'

function readFill(field: string) {
  return readColorFieldOf(alignmentsColorEncoding(colorSettingOf({ field })))
}

describe('readColorFieldOf', () => {
  test('every preset field selects the scheme of its name', () => {
    for (const field of COLOR_FIELDS) {
      expect(readFill(field)).toBe(field)
      expect(colorSchemeOf(readFill(field))).toBe(field)
    }
  })

  test('a read dimension the facet also offers is spelt the facet’s way', () => {
    const shared = ['strand', 'firstOfPairStrand', 'pairOrientation', 'mapq']
    for (const field of shared) {
      expect(Object.hasOwn(FACET_LABELS, field)).toBe(true)
      expect(COLOR_FIELDS).toContain(field)
    }
  })

  test('tags.XX and any other name paint through the per-read bake', () => {
    expect(colorSchemeOf(readFill('tags.HP'))).toBe('tag')
    expect(colorSchemeOf(readFill('score'))).toBe('tag')
  })

  test('no field paints the plain fill', () => {
    expect(readFill('')).toBe('')
    expect(colorSchemeOf('')).toBe('normal')
  })

  test('a per-base field is no read fill, and costs no attribute lookup', () => {
    for (const field of BASE_COLOR_FIELDS) {
      expect(readFill(field)).toBe('')
    }
  })
})

describe('baseLayerOf', () => {
  const shown = (field: string) => ({ show: true, field })

  test('every per-base field selects the layer of its name', () => {
    for (const field of BASE_COLOR_FIELDS) {
      expect(baseLayerOf(shown(field))?.type).toBe(field)
    }
  })

  test('only the modification layers carry the modification settings', () => {
    const settings = { threshold: 50 }
    expect(baseLayerOf(shown('modifications'), settings)).toEqual({
      type: 'modifications',
      modifications: settings,
    })
    expect(baseLayerOf(shown('baseQuality'), settings)).toEqual({
      type: 'baseQuality',
    })
  })

  test('no field or a read field draws no layer', () => {
    expect(baseLayerOf(shown(''))).toBeUndefined()
    expect(baseLayerOf(shown('strand'))).toBeUndefined()
  })

  test('a named field draws nothing while the layer is hidden', () => {
    expect(baseLayerOf({ show: false, field: 'modifications' })).toBeUndefined()
  })
})

describe('bodyColorScheme', () => {
  test('a modification layer tints the plain fill and yields to a read field', () => {
    const mods = { type: 'modifications' } as const
    expect(bodyColorScheme('', mods)).toBe('modifications')
    expect(bodyColorScheme('tags.HP', mods)).toBe('tag')
    expect(bodyColorScheme('', { type: 'base' })).toBe('normal')
    expect(bodyColorScheme('strand', undefined)).toBe('strand')
  })
})

describe('a Color by pick over the written color', () => {
  const hp: ColorSlots = {
    field: 'tags.HP',
    scale: { domain: ['1', '2'], range: ['red', 'blue'] },
  }

  test('the plain fill drops the field, and re-picking the parked one restores it', () => {
    expect(colorForField(hp, '').field).toBeUndefined()
    const back = colorForField({}, 'tags.HP', parkedColorOf(hp))
    expect(back).toMatchObject({
      field: 'tags.HP',
      scale: { range: ['red', 'blue'] },
    })
  })

  test('a new field starts from no order or range and keeps the constant', () => {
    expect(colorForField({ ...hp, value: 'grey' }, 'strand')).toEqual({
      value: 'grey',
      field: 'strand',
    })
  })
})

describe('pinnedInsertSizeBand', () => {
  const band = (over: ColorSlots) =>
    pinnedInsertSizeBand(alignmentsColorEncoding(colorSettingOf(over)))

  test('two cuts under an insert-size field pin the band', () => {
    expect(
      band({ field: 'insertSize', scale: { domain: ['150', '600'] } }),
    ).toEqual({
      lower: 150,
      upper: 600,
    })
    expect(
      band({ field: 'strand', scale: { domain: ['150', '600'] } }),
    ).toBeUndefined()
    expect(
      band({ field: 'insertSize', scale: { domain: ['150', '150'] } }),
    ).toBeUndefined()
  })
})
