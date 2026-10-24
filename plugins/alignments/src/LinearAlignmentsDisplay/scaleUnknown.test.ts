import PluginManager from '@jbrowse/core/PluginManager'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  alignmentsColorEncoding,
  alignmentsColorSettingOf,
} from '../shared/alignmentsColor.ts'
import { getReadDisplayLegendItems } from '../shared/legendUtils.ts'
import { bakedColorScale } from './bakedColorScale.ts'
import { buildColorPaletteFromPalette } from './components/alignmentComponentUtils.ts'
import configSchemaF from './configSchema.ts'
import { buildReadFillColors } from './readFillColors.ts'

const TAG = 'tags.HP'
const HAPLOTYPES = ['#d95f02', '#1b9e77']

function scaleOf(scale: Record<string, unknown>) {
  const pm = new PluginManager([])
  pm.createPluggableElements()
  pm.configure()
  const conf = configSchemaF(pm).create(
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'scale-unknown',
      encoding: { color: { field: TAG, scale } },
    },
    { pluginManager: pm },
  )
  const encoding = alignmentsColorEncoding(
    alignmentsColorSettingOf(conf.encoding.color),
  )
  return bakedColorScale(TAG, encoding, undefined, undefined)
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

test("scale.unknown '' files an unlisted value with the reads that have none", () => {
  const scale = scaleOf({ domain: ['1', '2'], range: HAPLOTYPES, unknown: '' })
  expect(bake(scale, ['1', '3'])).toEqual([packed(HAPLOTYPES[0]!), 0])
  expect(keyOf(scale, ['1', '3'])).toEqual([['1', HAPLOTYPES[0]]])
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
