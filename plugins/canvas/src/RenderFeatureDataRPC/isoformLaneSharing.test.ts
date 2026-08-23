import createJexlInstance from '@jbrowse/core/util/jexl'

import { buildFeatureRenderData } from './buildFeatureRenderData.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { type, name, start, end, subfeatures = [] } = opts
  return {
    get: (key: string) =>
      ({ type, name, start, end, strand: 1, subfeatures })[key],
    id: () => `${type}-${name}`,
    parent: () => undefined,
  } as unknown as Feature
}

function geneAt(name: string, start: number, isoforms: number) {
  return mockFeature({
    type: 'gene',
    name,
    start,
    end: start + 10_000,
    subfeatures: Array.from({ length: isoforms }, (_, i) =>
      mockFeature({
        type: 'mRNA',
        name: `${name}-tx${i}`,
        start: start + i,
        end: start + 9000 + i,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            name: `${name}-cds${i}`,
            start: start + i,
            end: start + 8000 + i,
          }),
        ],
      }),
    ),
  })
}

function drawnIsoforms(features: Feature[], name: string) {
  const data = buildFeatureRenderData({
    features,
    featureCount: features.length,
    config: mockDisplayConfig({
      geneGlyphMode: 'all',
      maxIsoforms: 20,
      geneOwnRows: 25 / 12,
      transcriptTypes: ['mRNA'],
    }),
    jexl,
    regionStart: 0,
    regionEnd: 100_000,
  })
  return data.subfeatureInfos.filter(
    info => info.parentFeatureId === `gene-${name}` && info.type === 'mRNA',
  ).length
}

// The sweep, the share and the collapse have their own tests; this is the one
// that holds the wiring between them — the ids the sweep keys on are the ids
// `layoutSubfeatures` looks itself up by, and the share reaches the budget
// through `LayoutArgs`. Wire any of those three wrong and every gene silently
// gets the whole lane again, which is the bug this exists to end.
describe('the isoform cap divided across a region', () => {
  it('leaves a gene alone in its lane the whole budget', () => {
    expect(drawnIsoforms([geneAt('A', 1000, 30)], 'A')).toBe(20)
  })

  it('halves it for a gene stacking with one other', () => {
    const genes = [geneAt('A', 1000, 30), geneAt('B', 5000, 30)]
    expect(drawnIsoforms(genes, 'A')).toBe(8)
    expect(drawnIsoforms(genes, 'B')).toBe(8)
  })

  // Far enough apart to pack onto the same row, so neither is paying for the
  // other — the case a pairwise overlap count would get wrong.
  it('leaves genes that do not stack alone', () => {
    const genes = [geneAt('A', 1000, 30), geneAt('B', 50_000, 30)]
    expect(drawnIsoforms(genes, 'A')).toBe(20)
    expect(drawnIsoforms(genes, 'B')).toBe(20)
  })
})
