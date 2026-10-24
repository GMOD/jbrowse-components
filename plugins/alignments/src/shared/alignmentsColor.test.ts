import {
  colorForField,
  parkedColorOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import { pileupBasesConfigSchema } from '../LinearAlignmentsDisplay/pileupBasesConfigSchema.ts'
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
  const bases = (snapshot: Record<string, unknown>) =>
    pileupBasesConfigSchema.create(snapshot)
  const shown = (field: string, rest: Record<string, unknown> = {}) =>
    bases({ show: true, encoding: { color: field }, ...rest })

  test('every per-base field selects the layer of its name', () => {
    for (const field of BASE_COLOR_FIELDS) {
      expect(baseLayerOf(shown(field))?.field).toBe(field)
    }
  })

  test('only the modification layers carry unmodified and the filter', () => {
    const rest = {
      filter: [{ field: 'probability', gte: 0.5 }],
      unmodified: { show: true },
    }
    expect(baseLayerOf(shown('modifications', rest))).toEqual({
      field: 'modifications',
      unmodified: true,
      filter: { probability: { min: 0.5, strict: false }, context: 'CG' },
    })
    expect(baseLayerOf(shown('baseQuality', rest))).toEqual({
      field: 'baseQuality',
    })
  })

  test('no field draws no layer', () => {
    expect(baseLayerOf(bases({ show: true }))).toBeUndefined()
  })

  test('a named field draws nothing while the layer is hidden', () => {
    expect(
      baseLayerOf(bases({ show: false, encoding: { color: 'modifications' } })),
    ).toBeUndefined()
  })
})

describe('bodyColorScheme', () => {
  test('a modification layer tints the plain fill and yields to a read field', () => {
    const mods = { field: 'modifications' } as const
    expect(bodyColorScheme('', mods)).toBe('modifications')
    expect(bodyColorScheme('tags.HP', mods)).toBe('tag')
    expect(bodyColorScheme('', { field: 'base' })).toBe('normal')
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
