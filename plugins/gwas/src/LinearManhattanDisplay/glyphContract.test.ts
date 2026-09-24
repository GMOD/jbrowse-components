import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { manhattanLayer } from './manhattanLayer.ts'

function glyphs(ldColoring: boolean, fields: Record<string, string>[]) {
  const { encoding, lanes } = manhattanLayer({
    scoreField: 'score',
    color: 'red',
    ldColoring,
  })
  const features = fields.map(
    (f, i) =>
      new SimpleFeature({
        uniqueId: String(i),
        refName: '1',
        start: i,
        end: i + 1,
        score: 1,
        ...f,
      }),
  )
  return [...encodeFeatures(features, encoding, lanes).glyph]
}

test('the three glyph classes stay distinct', () => {
  expect(new Set([GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DIAMOND]).size).toBe(3)
})

test('an insertion SV is the triangle, and every other feature a disc', () => {
  expect(
    glyphs(false, [
      { svtype: 'INS' },
      { svtype: 'DEL' },
      { svtype: 'DUP' },
      {},
    ]),
  ).toEqual([GLYPH_TRIANGLE, GLYPH_DISC, GLYPH_DISC, GLYPH_DISC])
})

test('under LD coloring the index SNP is the diamond, and its partners discs', () => {
  expect(
    glyphs(true, [{ ld_role: 'index' }, { ld_role: 'partner' }, {}]),
  ).toEqual([GLYPH_DIAMOND, GLYPH_DISC, GLYPH_DISC])
})
