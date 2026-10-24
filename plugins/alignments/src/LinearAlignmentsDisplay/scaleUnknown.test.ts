import PluginManager from '@jbrowse/core/PluginManager'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  alignmentsColorEncoding,
  alignmentsColorProblems,
  alignmentsColorSettingOf,
} from '../shared/alignmentsColor.ts'
import { colorSettingOf } from '../shared/colorSettingFixture.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { bakedColorScale } from './bakedColorScale.ts'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import configSchemaF from './configSchema.ts'
import { buildReadFillColors } from './readFillColors.ts'

const TAG = 'tags.HP'
const HAPLOTYPES = ['#d95f02', '#1b9e77']

function scaleOf(scale: Record<string, unknown>, field = TAG) {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  const conf = configSchemaF(pm).create(
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'scale-unknown',
      encoding: { color: { field, scale } },
    },
    { pluginManager: pm },
  )
  const encoding = alignmentsColorEncoding(
    alignmentsColorSettingOf(conf.encoding.color),
  )
  return bakedColorScale(field, encoding, undefined, undefined)
}

function bake(scale: ReturnType<typeof scaleOf>, values: string[]) {
  return [
    ...buildReadFillColors(
      makePileupDataResult({
        readTagValues: values,
        readStrands: new Int8Array(values.length).fill(1),
      }),
      TAG,
      scale,
    ),
  ]
}

function keyOf(scale: ReturnType<typeof scaleOf>, values: string[]) {
  return getReadDisplayLegendItems({
    colorField: TAG,
    bakedScale: scale,
    presentTagValues: new Set(values),
    presentCategories: new Set(),
    palette: buildColorPaletteFromPalette(resolvePalette()),
  }).map(({ label, color }) => [label, color])
}

const packed = (color: string) => {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

test('scale.unknown paints every value the domain leaves out, keyed as Other', () => {
  const scale = scaleOf({
    domain: ['1', '2'],
    range: HAPLOTYPES,
    unknown: '#999999',
  })
  expect(bake(scale, ['1', '2', '3', '0', ''])).toEqual([
    packed(HAPLOTYPES[0]!),
    packed(HAPLOTYPES[1]!),
    packed('#999999'),
    packed('#999999'),
    0,
  ])
  expect(keyOf(scale, ['1', '2', '3', '0', ''])).toEqual([
    ['1', HAPLOTYPES[0]],
    ['2', HAPLOTYPES[1]],
    ['Other', '#999999'],
  ])
})

test('no Other row while every value on screen is listed or has none', () => {
  const scale = scaleOf({
    domain: ['1', '2'],
    range: HAPLOTYPES,
    unknown: '#999999',
  })
  expect(keyOf(scale, ['1', '2', ''])).toEqual([
    ['1', HAPLOTYPES[0]],
    ['2', HAPLOTYPES[1]],
  ])
})

test("scale.unknown '' paints an unlisted value the no-value grey, keyed as Other", () => {
  const scale = scaleOf({ domain: ['1', '2'], range: HAPLOTYPES, unknown: '' })
  expect(bake(scale, ['1', '3'])).toEqual([
    packed(HAPLOTYPES[0]!),
    packed(NO_CATEGORY_COLOR),
  ])
  expect(keyOf(scale, ['1', '3'])).toEqual([
    ['1', HAPLOTYPES[0]],
    ['Other', NO_CATEGORY_COLOR],
  ])
})

test('with no domain every value is unknown, as under d3', () => {
  const scale = scaleOf({ unknown: '#999999' })
  expect(bake(scale, ['1', 'x'])).toEqual([
    packed('#999999'),
    packed('#999999'),
  ])
  expect(keyOf(scale, ['1', 'x'])).toEqual([['Other', '#999999']])
})

test('an ordinal MAPQ scale paints an unlisted score unknown', () => {
  const scale = scaleOf(
    { type: 'ordinal', domain: ['60'], range: ['#0000ff'], unknown: '#999999' },
    'mapq',
  )
  const fills = buildReadFillColors(
    makePileupDataResult({
      readStrands: new Int8Array(2).fill(1),
      readMapqs: new Uint8Array([60, 5]),
    }),
    'mapq',
    scale,
  )
  expect([...fills]).toEqual([packed('#0000ff'), packed('#999999')])
})

test('a field with fixed levels says unknown paints nothing', () => {
  expect(
    alignmentsColorProblems(
      colorSettingOf({ field: 'strand', scale: { unknown: '#999999' } }),
    ),
  ).toEqual([
    'encoding.color.scale.unknown: strand has no value outside its levels (1, -1); scale.range recolors a level',
  ])
})

test('unset, an unlisted value is dealt its own palette color', () => {
  const scale = scaleOf({ domain: ['1', '2'], range: HAPLOTYPES })
  const [, , third] = bake(scale, ['1', '2', '3'])
  expect(third).not.toBe(0)
  expect(keyOf(scale, ['1', '2', '3']).map(([label]) => label)).toEqual([
    '1',
    '2',
    '3',
  ])
})
