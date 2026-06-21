import { createJBrowseTheme } from '@jbrowse/core/ui'

import { findGlyph } from './findGlyph.ts'
import {
  hasMatureProteinChildren,
  layoutMatureProteinRegion,
} from './matureProteinRegion.ts'
import { collectRenderData } from '../collectRenderData.ts'
import { mockDisplayConfig } from '../testUtils.ts'

import type { Feature } from '@jbrowse/core/util'

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

// A viral polyprotein: one big CDS whose mature_protein_region children are the
// cleavage products tiled along the ORF.
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
    // rowHeight = featureHeight(10), padding 1 -> boxHeight 8
    expect(layout.height).toBe(20)
    expect(layout.children[0]!.y).toBe(1)
    expect(layout.children[0]!.height).toBe(8)
    expect(layout.children[1]!.y).toBe(11)
  })

  it('doubles row height for below labels', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
    ])
    const layout = layoutMatureProteinRegion({
      feature,
      config: mockDisplayConfig({ subfeatureLabels: 'below' }),
    })
    // rowHeight = 20, boxHeight = floor(20/2)-1 = 9
    expect(layout.height).toBe(40)
    expect(layout.children[0]!.y).toBe(1)
    expect(layout.children[0]!.height).toBe(9)
    expect(layout.children[1]!.y).toBe(21)
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
  const theme = createJBrowseTheme()

  it('draws a rect per mature region plus a strand arrow on the parent CDS', () => {
    const feature = viralPolyprotein([
      'mature_protein_region',
      'mature_protein_region',
      'mature_protein_region',
    ])
    const config = mockDisplayConfig()
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collectRenderData([layout], 0, 10000, config, theme, false)

    // one rect per mature region
    expect(result.rectPositions).toHaveLength(3 * 2)
    // single strand arrow at the CDS end (strand +1)
    expect(result.arrowXs).toHaveLength(1)
    expect(result.arrowXs[0]).toBe(feature.get('end'))
    expect(result.arrowDirections[0]).toBe(1)
    // each region gets a distinct palette color
    expect(new Set(result.rectColors).size).toBe(3)
    // each region is individually hoverable/selectable via subfeature hit info,
    // parented to the top-level CDS
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
    // mirrors the test_data configs: prefer the GFF `product` attribute
    const config = mockDisplayConfig({
      labels: {
        name: "jexl:get(feature,'product') || get(feature,'name') || get(feature,'id')",
        description: '',
      },
    })
    const layout = findGlyph(feature, config)({ feature, config })

    const result = collectRenderData([layout], 0, 10000, config, theme, false)
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

    const result = collectRenderData([layout], 0, 10000, config, theme, false)
    // the top-level CDS emits its own (name) label; keep only the per-mature
    // subfeature labels, which is what was previously missing entirely
    const labels = Object.values(result.floatingLabelsData).filter(
      l => 'subfeatureLabel' in l,
    )
    expect(labels).toHaveLength(2)
    expect(labels.map(l => l.subfeatureLabel.text)).toEqual([
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

    const result = collectRenderData([layout], 0, 10000, config, theme, false)
    const subfeatureLabels = Object.values(result.floatingLabelsData).filter(
      l => 'subfeatureLabel' in l,
    )
    expect(subfeatureLabels).toHaveLength(0)
  })

  it('omits the strand arrow when the CDS is not top-level', () => {
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

    const result = collectRenderData([layout], 0, 10000, config, theme, false)
    expect(result.rectPositions).toHaveLength(2 * 2)
    expect(result.arrowXs).toHaveLength(0)
  })

  // Real NCBI SARS-CoV-2 shape (test_data/sars-cov2/ncbi_original.gff3):
  // gene → CDS (no mRNA layer) → mature_protein_region_of_CDS. The gene routes
  // to Subfeatures and the CDS child to MatureProteinRegion; the cleavage
  // products must still be emitted as individual rows rather than collapsed to
  // a single flat box.
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

    const result = collectRenderData([layout], 0, 100000, config, theme, false)
    // one rect per mature region, not a single collapsed box
    expect(result.rectPositions).toHaveLength(3 * 2)
    expect([...result.rectPositions]).toEqual([266, 805, 805, 2719, 2719, 8554])
    // rows are stacked, not all at the same y
    expect(new Set(result.rectYs).size).toBe(3)
    // distinct palette colors per region
    expect(new Set(result.rectColors).size).toBe(3)
    // each region is hoverable as a subfeature, parented to the top-level gene
    // (the id GetCanvasFeatureDetails can resolve) so findSubfeatureById can
    // recurse gene → CDS → region
    expect(result.subfeatureInfos).toHaveLength(3)
    expect(
      result.subfeatureInfos.every(s => s.parentFeatureId === gene.id()),
    ).toBe(true)
    expect(result.subfeatureInfos.map(s => s.featureId)).toEqual(
      matures.map(m => m.id()),
    )
  })
})
