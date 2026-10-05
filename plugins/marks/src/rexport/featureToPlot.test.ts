import {
  featureFields,
  featurePlot,
  translateFilters,
} from './featureToPlot.ts'
import { frameFor } from './frameFor.ts'
import { assembleRScript } from './rScript.ts'

import type { FeatureDisplaySpec } from './featureToPlot.ts'

const REGIONS = [{ refName: 'ctgA', start: 0, end: 24000 }]

function script(
  display: FeatureDisplaySpec,
  type: 'Gff3TabixAdapter' | 'BedTabixAdapter' = 'Gff3TabixAdapter',
) {
  const f = frameFor({
    type,
    uri: 'x',
    name: 'genes',
    fields: featureFields(display, REGIONS),
    wholeFeatures: true,
  })
  const { plot, notes } = featurePlot({ display, frame: f, regions: REGIONS })
  return {
    r: assembleRScript({
      regions: REGIONS,
      panels: [{ variable: 'p1', plot }],
    }),
    notes,
  }
}

describe('a feature filter crosses to R', () => {
  it('as an attribute comparison in either spelling', () => {
    const { rules, untranslated } = translateFilters([
      `jexl:get(feature,'gbkey') != 'Src'`,
      `jexl:feature.type == 'gene'`,
      `jexl:feature.score > 3`,
    ])
    expect(rules.map(r => [r.attr, r.op, r.value])).toEqual([
      ['gbkey', '!=', 'Src'],
      ['type', '==', 'gene'],
    ])
    expect(untranslated).toEqual(['feature.score > 3'])
  })

  it('reads the attributes it compares', () => {
    expect(
      featureFields({ filter: [`jexl:get(feature,'biotype') == 'x'`] }),
    ).toEqual(['biotype', 'gbkey', 'note'])
  })

  it('names one it cannot translate in the header', () => {
    const { notes } = script({ filter: ['jexl:feature.score > 3'] })
    expect(notes.join('\n')).toMatch(/feature.score > 3/)
  })
})

describe('the gene panel', () => {
  it('admits by showOnlyGenes as a predicate a reader can edit', () => {
    expect(script({ showOnlyGenes: true }).r).toMatch(
      /# showOnlyGenes\n {2}function\(f\) grepl/,
    )
  })

  it('collapses isoforms only where the mode does', () => {
    expect(script({ geneGlyphMode: 'all' }).r).not.toMatch(
      /collapse_isoforms\(genes/,
    )
    expect(script({ geneGlyphMode: 'longestCoding' }).r).toMatch(
      /collapse_isoforms\(genes/,
    )
  })

  it('paints a UTR the track colour when only that is set', () => {
    expect(script({ color: 'purple' }).r).toMatch(
      /CDS = "purple", UTR = "purple"/,
    )
  })

  it('shapes a BED frame as gene models and drops the GFF-only gates', () => {
    const { r } = script({}, 'BedTabixAdapter')
    expect(r).toMatch(/genes <- bed_features\(genes\)/)
    expect(r).not.toMatch(/gbkey/)
  })
})
