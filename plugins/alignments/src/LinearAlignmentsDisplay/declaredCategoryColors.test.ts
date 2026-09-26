import { resolvePalette } from '@jbrowse/core/ui/palette'

import { buildArcColorPalette } from '../shaders/palettes.ts'
import { UNIFORM_SLOT_ARRAYS } from '../shaders/slang/read.iface.generated.ts'
import {
  alignmentsColorEncoding,
  declaredReadCategoryColors,
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
  return buildColorPaletteFromPalette(resolvePalette({}), {
    declared: declaredReadCategoryColors(
      alignmentsColorEncoding({ ...UNSET, ...color }),
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

  test('paints RR its colour and leaves LR at its default on every backend', () => {
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

  test('the key names RR in the declared colour and LR in its default', () => {
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

  test('share one default colour', () => {
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

  test('a threshold range over insert size colours the three bins', () => {
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

test('nothing declared, or a range over an open field, leaves the defaults', () => {
  expect(paletteFor({ field: 'pairOrientation' }).readCategoryColors).toEqual(
    DEFAULT.readCategoryColors,
  )
  expect(
    paletteFor({ field: 'tags.HP', range: ['#ff0000'] }).readCategoryColors,
  ).toEqual(DEFAULT.readCategoryColors)
})
