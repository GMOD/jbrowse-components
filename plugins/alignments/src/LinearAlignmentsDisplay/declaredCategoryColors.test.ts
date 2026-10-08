import { resolvePalette } from '@jbrowse/core/ui/palette'

import {
  buildArcColorPalette,
  buildLinkedReadColorPalette,
} from '../shaders/palettes.ts'
import { UNIFORM_SLOT_ARRAYS } from '../shaders/slang/read.iface.generated.ts'
import {
  alignmentsColorEncoding,
  alignmentsColorNotices,
  writtenReadCategoryColors,
} from '../shared/alignmentsColor.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import {
  READ_COLOR_CATEGORY,
  categorySwatchColor,
  readColorFromCategoryIndex,
  rgb255,
} from './colorUtils.ts'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import {
  PILEUP_UNIFORMS_SIZE_BYTES,
  pileupUniformViews,
  writePileupPalette,
} from './renderers/pileupUniforms.ts'
import { makeTestRenderState } from './testUtils.ts'

import type { ColorPalette } from '../shaders/colors.ts'
import type { AlignmentsColorSetting } from '../shared/alignmentsColor.ts'
import type { ReadColorCategory, SwatchCategory } from './colorUtils.ts'

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

function paletteFor(color: Partial<AlignmentsColorSetting>) {
  const setting = { ...UNSET, ...color }
  return buildColorPaletteFromPalette(resolvePalette({}), {
    declared: writtenReadCategoryColors(
      setting.value,
      alignmentsColorEncoding(setting),
    ),
  })
}

const DEFAULT = buildColorPaletteFromPalette(resolvePalette({}))

function uniformColor(palette: ColorPalette, category: ReadColorCategory) {
  const views = pileupUniformViews(new ArrayBuffer(PILEUP_UNIFORMS_SIZE_BYTES))
  writePileupPalette(views, makeTestRenderState({ colors: palette }))
  const o =
    UNIFORM_SLOT_ARRAYS.readCategoryColor[READ_COLOR_CATEGORY[category]]!
  return rgb255([views.f32[o]!, views.f32[o + 1]!, views.f32[o + 2]!])
}

const ONE_READ = {
  readStrands: Int8Array.of(1),
  readFlags: Uint16Array.of(0),
  readMapqs: Uint8Array.of(0),
  readInsertSizes: Float32Array.of(0),
  readPairOrientations: Uint8Array.of(0),
  readTagColors: new Uint32Array(0),
  readInterchrom: Uint8Array.of(0),
}

function everyPathPaints(palette: ColorPalette, category: SwatchCategory) {
  return [
    uniformColor(palette, category),
    categorySwatchColor(category, palette),
    readColorFromCategoryIndex(
      READ_COLOR_CATEGORY[category],
      0,
      ONE_READ,
      palette,
    ),
  ]
}

describe('a declared range on a preset field', () => {
  const palette = paletteFor({
    field: 'pairOrientation',
    domain: ['RR'],
    range: ['#d95f02'],
  })

  test('paints RR its color and leaves LR at its default on every backend', () => {
    expect(everyPathPaints(palette, 'pairRR')).toEqual(
      new Array(3).fill('rgb(217,95,2)'),
    )
    expect(everyPathPaints(palette, 'pairLR')).toEqual(
      new Array(3).fill(categorySwatchColor('pairLR', DEFAULT)),
    )
  })

  test("an LR override reaches the arc band's baseline under pair orientation only", () => {
    const lr = paletteFor({
      field: 'pairOrientation',
      domain: ['LR'],
      range: ['#1b9e77'],
    })
    const baseline = (field: 'pairOrientation' | 'insertSize') =>
      rgb255(buildArcColorPalette(lr, field)[0]!)
    expect(baseline('pairOrientation')).toBe('rgb(27,158,119)')
    expect(baseline('insertSize')).toBe(categorySwatchColor('pairLR', DEFAULT))
  })

  test('the key names RR in the declared color and LR in its default', () => {
    const items = getReadDisplayLegendItems({
      colorBy: { type: 'pairOrientation' },
      palette,
      presentCategories: new Set<ReadColorCategory>(['pairLR', 'pairRR']),
    })
    expect(items.map(i => i.color)).toEqual([
      categorySwatchColor('pairLR', DEFAULT),
      'rgb(217,95,2)',
    ])
  })
})

describe('the five levels that share the neutral default', () => {
  const LEVELS: [Partial<AlignmentsColorSetting>, SwatchCategory][] = [
    [{ field: 'pairOrientation', domain: ['LR'] }, 'pairLR'],
    [{ field: 'pairOrientation', domain: [''] }, 'nonSplit'],
    [
      { field: 'insertSize', scale: 'categorical', domain: ['normal'] },
      'normalInsert',
    ],
    [{ field: 'tags.HP', domain: [''] }, 'noTagValue'],
    [{ field: 'mapq', domain: ['255'] }, 'mapqUnavailable'],
  ]
  const neutral = categorySwatchColor('pairLR', DEFAULT)

  test('share one default color', () => {
    for (const [, category] of LEVELS) {
      expect(categorySwatchColor(category, DEFAULT)).toBe(neutral)
    }
  })

  test.each(LEVELS)('%o overrides %s alone', (color, category) => {
    const palette = paletteFor({ ...color, range: ['#1b9e77'] })
    for (const [, other] of LEVELS) {
      expect([other, everyPathPaints(palette, other)]).toEqual([
        other,
        new Array(3).fill(other === category ? 'rgb(27,158,119)' : neutral),
      ])
    }
  })

  test('a threshold range over insert size colors the three bins', () => {
    const palette = paletteFor({
      field: 'insertSize',
      range: ['#000000', '#888888', '#ffffff'],
    })
    expect(
      (['shortInsert', 'normalInsert', 'longInsert'] as const).map(c =>
        categorySwatchColor(c, palette),
      ),
    ).toEqual(['rgb(0,0,0)', 'rgb(136,136,136)', 'rgb(255,255,255)'])
  })
})

describe('a domain that names no level says so', () => {
  const notices = (color: Partial<AlignmentsColorSetting>) =>
    alignmentsColorNotices({ ...UNSET, ...color })

  test("strand's levels are 1 and -1, so '+' names none", () => {
    expect(
      notices({ field: 'strand', domain: ['+', '-'], range: ['#f00', '#00f'] }),
    ).toEqual([
      'color.domain: "+" names no level of strand, whose levels are 1, -1',
      'color.domain: "-" names no level of strand, whose levels are 1, -1',
    ])
  })

  test('a level under the threshold insert size reads as a cut point', () => {
    expect(
      notices({ field: 'insertSize', domain: ['normal'], range: ['#1b9e77'] }),
    ).toContain(
      'color.domain: names a level of insertSize (short, normal, long), which a threshold scale reads as a cut point; scale: "categorical" colors the levels',
    )
  })

  test('a level the field has, or a tag value, passes', () => {
    expect(notices({ field: 'pairOrientation', domain: ['RR'] })).toEqual([])
    expect(notices({ field: 'tags.HP', domain: ['x'] })).toEqual([])
  })

  test("labels with no domain name the field's own levels", () => {
    expect(notices({ field: 'strand', labels: ['Fwd', 'Rev'] })).toEqual([])
    expect(
      notices({ field: 'insertSize', labels: ['Short', 'Ok', 'Long'] }),
    ).toEqual([])
    expect(notices({ field: 'strand', labels: ['a', 'b', 'c'] })).toEqual([
      'color.labels: labels names one value each, and 3 labels name 2 values: a label past them names nothing',
    ])
    expect(
      notices({ field: 'pairOrientation', domain: ['RR'], labels: ['a', 'b'] }),
    ).toHaveLength(1)
  })
})

test('nothing declared, or a range over an open field, leaves the defaults', () => {
  expect(paletteFor({ field: 'pairOrientation' }).readCategoryColors).toEqual(
    DEFAULT.readCategoryColors,
  )
  expect(
    paletteFor({ field: 'tags.HP', range: ['#ff0000'] }).readCategoryColors,
  ).toEqual(DEFAULT.readCategoryColors)
})

describe('color.value fills the reads no field colors', () => {
  const STEEL = 'rgb(70,130,180)'
  const neutral = categorySwatchColor('pairLR', DEFAULT)

  test('the plain read, a tag scheme before its bake, and a read with no value', () => {
    const palette = paletteFor({ value: 'steelblue', field: 'tags.HP' })
    expect(uniformColor(palette, 'plain')).toBe(STEEL)
    expect(uniformColor(palette, 'tag')).toBe(STEEL)
    expect(everyPathPaints(palette, 'noTagValue')).toEqual(
      new Array(3).fill(STEEL),
    )
  })

  test('arcs, connection curves and the other neutral buckets keep the theme', () => {
    const palette = paletteFor({ value: 'steelblue' })
    for (const category of [
      'pairLR',
      'nonSplit',
      'normalInsert',
      'mapqUnavailable',
    ] as const) {
      expect([category, everyPathPaints(palette, category)]).toEqual([
        category,
        new Array(3).fill(neutral),
      ])
    }
    for (const field of ['insertSize', 'pairOrientation'] as const) {
      expect(rgb255(buildArcColorPalette(palette, field)[0]!)).toBe(neutral)
    }
    const curves = buildLinkedReadColorPalette(palette)
    expect([rgb255(curves[0]!), rgb255(curves[1]!)]).toEqual([neutral, neutral])
  })

  test("a declared '' level colors the no-value read over value", () => {
    const palette = paletteFor({
      value: 'steelblue',
      field: 'tags.HP',
      domain: [''],
      range: ['#1b9e77'],
    })
    expect(categorySwatchColor('noTagValue', palette)).toBe('rgb(27,158,119)')
    expect(uniformColor(palette, 'plain')).toBe(STEEL)
  })
})
