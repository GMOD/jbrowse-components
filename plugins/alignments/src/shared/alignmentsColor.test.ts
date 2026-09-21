import {
  BASE_COLOR_FIELDS,
  COLOR_FIELDS,
  baseLayerOf,
  bodyColorScheme,
  colorByOf,
  colorFieldOf,
  colorSnapshotFor,
  pinnedInsertSizeBand,
} from './alignmentsColor.ts'
import { GROUP_BY_LABELS } from './groupByLabels.ts'

import type { AlignmentsColorSetting } from './alignmentsColor.ts'
import type { ColorBy } from './types.ts'

const UNSET: AlignmentsColorSetting = {
  value: undefined,
  field: '',
  scale: undefined,
  domain: [],
  range: [],
  scheme: undefined,
  reverse: false,
  domainMin: undefined,
  domainMax: undefined,
  domainMid: undefined,
}

describe('colorByOf', () => {
  test('every preset field selects its scheme and names it back', () => {
    for (const [scheme, field] of Object.entries(COLOR_FIELDS)) {
      const colorBy = colorByOf({ field, scale: undefined })
      expect(colorBy.type).toBe(scheme)
      expect(colorFieldOf(colorBy)).toBe(field)
    }
  })

  test('a read dimension the facet also offers is spelt the facet’s way', () => {
    const shared = ['strand', 'firstOfPairStrand', 'pairOrientation', 'mapq']
    for (const field of shared) {
      expect(Object.hasOwn(GROUP_BY_LABELS, field)).toBe(true)
      expect(Object.values(COLOR_FIELDS)).toContain(field)
    }
  })

  test('tags.XX reads a SAM tag and any other name a feature attribute', () => {
    expect(colorByOf({ field: 'tags.HP', scale: undefined })).toEqual({
      type: 'tag',
      tag: 'HP',
    })
    expect(colorByOf({ field: 'score', scale: undefined })).toEqual({
      type: 'tag',
      attribute: 'score',
    })
  })

  test('no field, or a field under none, paints the plain fill', () => {
    expect(colorByOf({ field: '', scale: undefined }).type).toBe('normal')
    expect(colorByOf({ field: 'strand', scale: 'none' }).type).toBe('normal')
  })

  test('a per-base field is no read fill, and costs no attribute lookup', () => {
    for (const field of Object.values(BASE_COLOR_FIELDS)) {
      expect(colorByOf({ field, scale: undefined })).toEqual({ type: 'normal' })
    }
  })
})

describe('baseLayerOf', () => {
  test('every per-base field selects its layer', () => {
    for (const [layer, field] of Object.entries(BASE_COLOR_FIELDS)) {
      expect(baseLayerOf({ field, scale: undefined })?.type).toBe(layer)
    }
  })

  test('only the modification layers carry the modification settings', () => {
    const settings = { threshold: 50 }
    expect(
      baseLayerOf({ field: 'modifications', scale: undefined }, settings),
    ).toEqual({ type: 'modifications', modifications: settings })
    expect(
      baseLayerOf({ field: 'baseQuality', scale: undefined }, settings),
    ).toEqual({ type: 'perBaseQuality' })
  })

  test('no field, a read field, or a field under none draws no layer', () => {
    expect(baseLayerOf({ field: '', scale: undefined })).toBeUndefined()
    expect(baseLayerOf({ field: 'strand', scale: undefined })).toBeUndefined()
    expect(baseLayerOf({ field: 'base', scale: 'none' })).toBeUndefined()
  })
})

describe('bodyColorScheme', () => {
  test('a modification layer tints the plain fill and yields to a read field', () => {
    const mods = { type: 'modifications' } as const
    expect(bodyColorScheme({ type: 'normal' }, mods)).toBe('modifications')
    expect(bodyColorScheme({ type: 'tag', tag: 'HP' }, mods)).toBe('tag')
    expect(bodyColorScheme({ type: 'normal' }, { type: 'perBaseLetter' })).toBe(
      'normal',
    )
    expect(bodyColorScheme({ type: 'strand' }, undefined)).toBe('strand')
  })
})

describe('colorSnapshotFor', () => {
  const hp: AlignmentsColorSetting = {
    ...UNSET,
    field: 'tags.HP',
    domain: ['1', '2'],
    range: ['red', 'blue'],
  }
  const tagHP: ColorBy = { type: 'tag', tag: 'HP' }

  test('the plain fill keeps the field under none, and re-picking it restores it', () => {
    expect(colorSnapshotFor({ type: 'normal' }, hp)).toMatchObject({
      field: 'tags.HP',
      scale: 'none',
      domain: ['1', '2'],
    })
    const back = colorSnapshotFor(tagHP, { ...hp, scale: 'none' })
    expect(back).toMatchObject({ field: 'tags.HP', range: ['red', 'blue'] })
    expect(back.scale).toBeUndefined()
  })

  test('a new field starts from no order or range and keeps the constant', () => {
    expect(
      colorSnapshotFor({ type: 'strand' }, { ...hp, value: 'grey' }),
    ).toEqual({ value: 'grey', field: 'strand' })
  })
})

describe('pinnedInsertSizeBand', () => {
  test('two ascending numbers under an insert-size field pin the band', () => {
    expect(
      pinnedInsertSizeBand({
        ...UNSET,
        field: 'insertSize',
        domain: ['150', '600'],
      }),
    ).toEqual({ lower: 150, upper: 600 })
    expect(
      pinnedInsertSizeBand({
        ...UNSET,
        field: 'strand',
        domain: ['150', '600'],
      }),
    ).toBeUndefined()
    expect(
      pinnedInsertSizeBand({
        ...UNSET,
        field: 'insertSize',
        domain: ['600', '150'],
      }),
    ).toBeUndefined()
  })
})
