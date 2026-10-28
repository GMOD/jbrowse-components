import { utrDefaultColor } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import {
  colorEncodingOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import { configSchemaFactory } from './configSchema.ts'
import {
  geneColorEncodingOf,
  geneColorRampOf,
  geneColors,
} from './geneColor.ts'

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
  const { fill, utr } = geneColors(
    conf,
    colorEncodingOf(colorSnapshotOf(conf.encoding.color)),
    conf.utrs.encoding.color.value,
    jexl,
  )
  return utr(gene, fill(gene, undefined))
}

test('a UTR keeps the contrasting blue where nothing sets the fill', () => {
  expect(utrOf({})).toBe(cssColorToABGR(utrDefaultColor))
})

test('a UTR takes the gene fill a written color sets, as on the feature track', () => {
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

test('score runs genes along a ramp over the features shown, and a UTR takes the fill', () => {
  const conf = schema.create({
    type: 'MultiWaySyntenyDisplay',
    displayId: 'ramp',
    encoding: {
      color: { field: 'score', scale: { range: ['black', 'white'] } },
    },
  })
  const encoding = geneColorEncodingOf(colorSnapshotOf(conf.encoding.color))
  const genes = [0, 5, 10].map(
    score =>
      new SimpleFeature({
        uniqueId: `s${score}`,
        refName: 'chr1',
        start: 0,
        end: 100,
        score,
      }),
  )
  const ramp = geneColorRampOf(encoding, jexl, () => genes)
  const { fill, utr } = geneColors(
    conf,
    encoding,
    undefined,
    jexl,
    undefined,
    ramp,
  )
  const [low, , high] = genes.map(g => fill(g, undefined).packed)
  expect(low).toBe(cssColorToABGR('black'))
  expect(high).toBe(cssColorToABGR('white'))
  expect(utr(genes[2]!, fill(genes[2]!, undefined))).toBe(high)
  expect(ramp!.keyScales('genes', undefined)[0]).toMatchObject({
    kind: 'ramp',
    domain: [0, 10],
  })
})
