import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from '../collectRenderData.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { findGlyph } from './findGlyph.ts'
import {
  hasMatureProteinChildren,
  layoutMatureProteinRegion,
} from './matureProteinRegion.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  start: number
  end: number
  strand?: number
  product?: string
  subfeatures?: ReturnType<typeof mockFeature>[]
  parentFeature?: Feature
}): Feature {
  const {
    type,
    start,
    end,
    strand = 1,
    product,
    subfeatures = [],
    parentFeature,
  } = opts
  const f = {
    get: (key: string) => {
      const map: Record<string, unknown> = {
        type,
        name: `${type}-${start}-${end}`,
        start,
        end,
        strand,
        product,
        subfeatures,
      }
      return map[key]
    },
    id: () => `${type}-${start}-${end}`,
    parent: () => parentFeature,
  }
  return f as unknown as Feature
}

// One big CDS whose mature_protein_region children tile the ORF as its cleavage
// products.
function viralPolyprotein(matureTypes: string[]) {
  const matures = matureTypes.map((type, i) =>
    mockFeature({ type, start: 100 + i * 100, end: 200 + i * 100 }),
  )
  return mockFeature({
    type: 'CDS',
    start: 100,
    end: 100 + matureTypes.length * 100,
    subfeatures: matures,
  })
}

describe('hasMatureProteinChildren', () => {
  it('detects mature_protein_region children', () => {
    expect(
      hasMatureProteinChildren(viralPolyprotein(['mature_protein_region'])),
    ).toBe(true)
  })

  it('detects mature_protein_region_of_CDS children', () => {
    expect(
      hasMatureProteinChildren(
        viralPolyprotein(['mature_protein_region_of_CDS']),
      ),
    ).toBe(true)
  })

  it('detects GenBank mat_peptide/sig_peptide children (GenBank→GFF3 conversion of a downloaded viral genome)', () => {
    expect(
      hasMatureProteinChildren(
        viralPolyprotein(['mat_peptide', 'sig_peptide']),
      ),
    ).toBe(true)
  })

  it('matches types case-insensitively, like isCDS/isExon', () => {
    expect(
      hasMatureProteinChildren(
        viralPolyprotein(['Mature_Protein_Region_of_CDS']),
      ),
    ).toBe(true)
  })

  it('is false for a plain CDS with no mature regions', () => {
    expect(
      hasMatureProteinChildren(mockFeature({ type: 'CDS', start: 1, end: 9 })),
    ).toBe(false)
  })

  it('is false when children are some other type', () => {
    expect(hasMatureProteinChildren(viralPolyprotein(['exon', 'exon']))).toBe(
      false,
    )
  })
})

describe('findGlyph routing for CDS', () => {
  const config = mockDisplayConfig()
  const args = { config }

  it('routes a CDS with mature regions to MatureProteinRegion', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
    ])
    expect(findGlyph(feature, config)({ feature, ...args }).glyphType).toBe(
      'MatureProteinRegion',
    )
  })

  it('routes a bare CDS to Box', () => {
    const feature = mockFeature({ type: 'CDS', start: 1, end: 9 })
    expect(findGlyph(feature, config)({ feature, ...args }).glyphType).toBe(
      'Box',
    )
  })

  it('treats lowercase cds the same as CDS', () => {
    const feature = mockFeature({ type: 'cds', start: 1, end: 9 })
    expect(findGlyph(feature, config)({ feature, ...args }).glyphType).toBe(
      'Box',
    )
  })

  // A GenBank flatfile conversion inserts an mRNA between the gene and the
  // polyprotein CDS, and dispatch recurses only through Subfeatures.
  it('reaches a polyprotein CDS nested under an mRNA', () => {
    const cds = viralPolyprotein([
      'mature_protein_region_of_CDS',
      'mature_protein_region_of_CDS',
    ])
    const mRNA = mockFeature({
      type: 'mRNA',
      start: 100,
      end: 300,
      subfeatures: [cds],
    })
    const gene = mockFeature({
      type: 'gene',
      start: 100,
      end: 300,
      subfeatures: [mRNA],
    })
    const layout = findGlyph(gene, config)({ feature: gene, ...args })
    expect(layout.glyphType).toBe('Subfeatures')
    expect(layout.children.map(c => c.glyphType)).toEqual(['Subfeatures'])
    expect(layout.children[0]!.children.map(c => c.glyphType)).toEqual([
      'MatureProteinRegion',
    ])
  })
})

describe('layoutMatureProteinRegion', () => {
  it('makes one row per mature region, sorted by position', () => {
    const c1 = mockFeature({
      type: 'mature_protein_region',
      start: 300,
      end: 400,
    })
    const c2 = mockFeature({
      type: 'mature_protein_region',
      start: 100,
      end: 200,
    })
    const feature = mockFeature({
      type: 'CDS',
      start: 100,
      end: 400,
      subfeatures: [c1, c2],
    })
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig(),
    })

    expect(layout.glyphType).toBe('MatureProteinRegion')
    expect(layout.children).toHaveLength(2)
    expect(layout.children.map(c => c.feature.get('start'))).toEqual([100, 300])
  })

  it('stacks rows at featureHeight with no labels', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
    ])
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig({ subfeatureLabels: 'none' }),
    })
    expect(layout.height).toBe(20)
    expect(layout.children[0]!.y).toBe(1)
    expect(layout.children[0]!.height).toBe(8)
    expect(layout.children[1]!.y).toBe(11)
  })

  // The label row is COUNTED, not carved out of the row height: the main thread
  // scales geometry by HEIGHT_MULTIPLIERS while a label draws on the gentler
  // LABEL_FONT_MULTIPLIERS.
  it('counts a label row per cleavage product and leaves the rows body-sized', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
    ])
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig({ subfeatureLabels: 'below' }),
    })
    expect(layout.height).toBe(20)
    expect(layout.children[0]!.y).toBe(1)
    expect(layout.children[0]!.height).toBe(8)
    expect(layout.children[1]!.y).toBe(11)
    expect(layout.labelRows).toBe(2)
    expect(layout.children.map(c => c.labelRowsAbove)).toEqual([0, 1])
    expect(layout.children.every(c => c.ownsLabelRow)).toBe(true)
  })

  it('counts no rows when below labels are off', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
    ])
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig({ subfeatureLabels: 'none' }),
    })
    expect(layout.labelRows).toBe(0)
    expect(layout.children.some(c => c.ownsLabelRow)).toBe(false)
  })

  it('always has at least one row even with no mature regions', () => {
    const feature = mockFeature({ type: 'CDS', start: 1, end: 9 })
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig(),
    })
    expect(layout.height).toBe(10)
    expect(layout.children).toHaveLength(0)
  })
})

describe('collectRenderData for mature protein regions', () => {
  const collect = (
    layout: FeatureLayout,
    config: DisplayConfig,
    regionEnd = 10_000,
  ) =>
    collectRenderData({
      layouts: [layout],
      regionStart: 0,
      regionEnd,
      config,
      colorByCDS: false,
      peptideDataMap: undefined,
      jexl,
    })

  it('draws a rect per mature region plus a strand arrow on the parent CDS', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
      'mature_protein_region',
    ])
    const config = mockDisplayConfig()
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collect(layout, config)

    expect(result.rectPositions).toHaveLength(3 * 2)
    expect(result.arrowXs).toHaveLength(1)
    expect(result.arrowXs[0]).toBe(feature.get('end'))
    expect(result.arrowDirections[0]).toBe(1)
    expect(new Set(result.rectColors).size).toBe(3)
    expect(result.subfeatureInfos).toHaveLength(3)
    expect(
      result.subfeatureInfos.every(s => s.parentFeatureId === feature.id()),
    ).toBe(true)
  })

  it('resolves the subfeature hover label from the labels.name config', () => {
    const matures = [
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        product: 'protein VP0',
      }),
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 200,
        end: 300,
        product: 'capsid protein VP1',
      }),
    ]
    const feature = mockFeature({
      type: 'CDS',
      start: 100,
      end: 300,
      subfeatures: matures,
    })
    const config = mockDisplayConfig({
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collect(layout, config)
    expect(result.subfeatureInfos.map(s => s.displayLabel)).toEqual([
      'protein VP0',
      'capsid protein VP1',
    ])
  })

  // The SARS-CoV-2 shape: one gene with two polyprotein CDS children that share
  // nsp cleavage products at identical coordinates, which is the only case where
  // a peptide is ambiguous.
  it('disambiguates a mature region shared by two polyprotein CDS under one gene (ORF1a/ORF1ab)', () => {
    const config = mockDisplayConfig({
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const pp1a = mockFeature({
      type: 'CDS',
      start: 100,
      end: 300,
      product: 'ORF1a polyprotein',
      subfeatures: [
        mockFeature({
          type: 'mature_protein_region_of_CDS',
          start: 100,
          end: 200,
          product: 'nsp1',
        }),
      ],
    })
    const pp1ab = mockFeature({
      type: 'CDS',
      start: 100,
      end: 400,
      product: 'ORF1ab polyprotein',
      subfeatures: [
        mockFeature({
          type: 'mature_protein_region_of_CDS',
          start: 100,
          end: 200,
          product: 'nsp1',
        }),
      ],
    })
    const gene = mockFeature({
      type: 'gene',
      start: 100,
      end: 400,
      subfeatures: [pp1a, pp1ab],
    })
    const layout = findGlyph(gene, config)({ feature: gene, config })

    const result = collect(layout, config)
    expect(result.subfeatureInfos.map(s => s.displayLabel)).toEqual([
      'nsp1 (ORF1a polyprotein)',
      'nsp1 (ORF1ab polyprotein)',
    ])
  })

  it('does not clutter labels with the CDS name for a single-polyprotein gene', () => {
    const config = mockDisplayConfig({
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const cds = mockFeature({
      type: 'CDS',
      start: 100,
      end: 400,
      product: 'genome polyprotein',
      subfeatures: [
        mockFeature({
          type: 'mature_protein_region_of_CDS',
          start: 100,
          end: 200,
          product: 'protein VP0',
        }),
        mockFeature({
          type: 'mature_protein_region_of_CDS',
          start: 200,
          end: 300,
          product: 'capsid protein VP1',
        }),
      ],
    })
    const gene = mockFeature({
      type: 'gene',
      start: 100,
      end: 400,
      subfeatures: [cds],
    })
    const layout = findGlyph(gene, config)({ feature: gene, config })

    const result = collect(layout, config)
    expect(result.subfeatureInfos.map(s => s.displayLabel)).toEqual([
      'protein VP0',
      'capsid protein VP1',
    ])
  })

  it('emits a floating label per mature region when subfeatureLabels is on', () => {
    const matures = [
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        product: 'protein VP0',
      }),
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 200,
        end: 300,
        product: 'capsid protein VP1',
      }),
    ]
    const feature = mockFeature({
      type: 'CDS',
      start: 100,
      end: 300,
      subfeatures: matures,
    })
    const config = mockDisplayConfig({
      subfeatureLabels: 'below',
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collect(layout, config)
    // The top-level CDS emits its own name label; only the per-mature
    // subfeature labels are under test.
    const labels = [...result.floatingLabelsData.values()].filter(
      l => 'subfeatureLabel' in l,
    )
    expect(labels).toHaveLength(2)
    expect(labels.map(l => l.subfeatureLabel?.text)).toEqual([
      'protein VP0',
      'capsid protein VP1',
    ])
    expect(labels.every(l => l.parentFeatureId === feature.id())).toBe(true)
  })

  it('omits mature-region floating labels when subfeatureLabels is none', () => {
    const matures = [
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 100,
        end: 200,
        product: 'protein VP0',
      }),
    ]
    const feature = mockFeature({
      type: 'CDS',
      start: 100,
      end: 300,
      subfeatures: matures,
    })
    const config = mockDisplayConfig({
      subfeatureLabels: 'none',
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collect(layout, config)
    const subfeatureLabels = [...result.floatingLabelsData.values()].filter(
      l => 'subfeatureLabel' in l,
    )
    expect(subfeatureLabels).toHaveLength(0)
  })

  // The enclosing gene renders as a Subfeatures container that draws no arrow,
  // so gating on top-level as leaf glyphs do would leave the polyprotein with no
  // direction at all.
  it('draws the strand arrow even when the CDS is nested under a gene', () => {
    const parent = mockFeature({ type: 'gene', start: 100, end: 400 })
    const matures = [
      mockFeature({ type: 'mature_protein_region', start: 100, end: 200 }),
      mockFeature({ type: 'mature_protein_region', start: 200, end: 300 }),
    ]
    const feature = mockFeature({
      type: 'CDS',
      start: 100,
      end: 400,
      subfeatures: matures,
      parentFeature: parent,
    })
    const config = mockDisplayConfig()
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collect(layout, config)
    expect(result.rectPositions).toHaveLength(2 * 2)
    expect(result.arrowXs).toHaveLength(1)
    expect(result.arrowXs[0]).toBe(feature.get('end'))
    expect(result.arrowDirections[0]).toBe(1)
  })

  // NCBI's SARS-CoV-2 shape has no mRNA layer: gene → CDS →
  // mature_protein_region_of_CDS.
  it('renders mature regions of a CDS nested directly under a gene', () => {
    const matures = [
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 266,
        end: 805,
      }),
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 805,
        end: 2719,
      }),
      mockFeature({
        type: 'mature_protein_region_of_CDS',
        start: 2719,
        end: 8554,
      }),
    ]
    const cds = mockFeature({
      type: 'CDS',
      start: 266,
      end: 8554,
      subfeatures: matures,
    })
    const gene = mockFeature({
      type: 'gene',
      start: 266,
      end: 8554,
      subfeatures: [cds],
    })
    const config = mockDisplayConfig()
    const layout = findGlyph(gene, config)({ feature: gene, config })
    expect(layout.glyphType).toBe('Subfeatures')

    const result = collect(layout, config, 100_000)
    expect(result.rectPositions).toHaveLength(3 * 2)
    expect([...result.rectPositions]).toEqual([266, 805, 805, 2719, 2719, 8554])
    expect(new Set(result.rectYs).size).toBe(3)
    expect(new Set(result.rectColors).size).toBe(3)
    // Parented to the top-level gene, the id GetCanvasFeatureDetails resolves,
    // so findSubfeatureById can recurse gene → CDS → region.
    expect(result.subfeatureInfos).toHaveLength(3)
    expect(
      result.subfeatureInfos.every(s => s.parentFeatureId === gene.id()),
    ).toBe(true)
    expect(result.subfeatureInfos.map(s => s.featureId)).toEqual(
      matures.map(m => m.id()),
    )
  })
})
