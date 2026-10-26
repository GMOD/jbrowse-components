import { utrDefaultColor } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import {
  colorEncodingOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import { configSchemaFactory } from './configSchema.ts'
import { geneColors } from './geneColor.ts'

const jexl = createJexlInstance()
const schema = configSchemaFactory()
const gene = new SimpleFeature({
  uniqueId: 'g1',
  refName: 'chr1',
  start: 0,
  end: 100,
})

function utrOf(snapshot: Record<string, unknown>) {
  const conf = schema.create({
    type: 'MultiWaySyntenyDisplay',
    displayId: 'utr',
    ...snapshot,
  })
  const colors = geneColors(
    conf,
    colorEncodingOf(colorSnapshotOf(conf.encoding.color)),
    conf.utrs.encoding.color.value,
    jexl,
  )
  return colors.utr(gene, colors.fill(gene, undefined))
}

test('a UTR keeps the contrasting blue where nothing sets the fill', () => {
  expect(utrOf({})).toBe(cssColorToABGR(utrDefaultColor))
})

test('a UTR takes the gene fill a written color sets, as on the canvas track', () => {
  expect(utrOf({ encoding: { color: { value: 'teal' } } })).toBe(
    cssColorToABGR('teal'),
  )
})

test('utrs.encoding.color paints every UTR over the fill', () => {
  expect(
    utrOf({
      encoding: { color: { value: 'teal' } },
      utrs: { encoding: { color: { value: 'orange' } } },
    }),
  ).toBe(cssColorToABGR('orange'))
})
