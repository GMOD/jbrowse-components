import { resolvePalette } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from './collectRenderData.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { layoutSubfeatures } from './glyphs/subfeatures.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  id: string
  start: number
  end: number
  strand?: number
  phase?: number
  subfeatures?: Feature[]
  // anything else the annotation carries, for the config-jexl slots that read
  // arbitrary attributes off a feature
  attributes?: Record<string, unknown>
}): Feature {
  const { strand = 1, subfeatures = [], attributes, ...rest } = opts
  const map: Record<string, unknown> = {
    strand,
    subfeatures,
    ...attributes,
    ...rest,
  }
  return {
    get: (key: string) => map[key],
    id: () => opts.id,
    parent: () => undefined,
  } as unknown as Feature
}

function boxLayout(feature: Feature): FeatureLayout {
  return {
    feature,
    glyphType: 'Box',
    y: 0,
    height: 10,
    children: [],
  }
}

const palette = resolvePalette()
const config = mockDisplayConfig({ color: '#cccc99' })

// Every case here walks ONE layout over the same context; only the region end,
// the config, the colorByCDS flag and the peptide map ever vary, so they arrive
// as overrides rather than as seven repeated arguments.
function collect(
  layout: FeatureLayout,
  overrides: Partial<Parameters<typeof collectRenderData>[0]> = {},
) {
  return collectRenderData({
    layouts: [layout],
    regionStart: 0,
    regionEnd: 1000,
    config,
    palette,
    colorByCDS: false,
    peptideDataMap: undefined,
    jexl,
    ...overrides,
  })
}

// Two CDS exons whose 9 coding bases (3 codons) make codon index 1 straddle the
// exon boundary: bases 100,101,102 (codon0) | 103 + 200,201 (codon1) | 202,203,204 (codon2)
function twoExonTranscript() {
  const cds1 = mockFeature({ type: 'CDS', id: 'cds1', start: 100, end: 104 })
  const cds2 = mockFeature({ type: 'CDS', id: 'cds2', start: 200, end: 205 })
  const mRNA = mockFeature({
    type: 'mRNA',
    id: 'tx1',
    start: 100,
    end: 205,
    subfeatures: [cds1, cds2],
  })
  return {
    layout: {
      feature: mRNA,
      glyphType: 'ProcessedTranscript' as const,
      y: 0,
      height: 10,
      children: [boxLayout(cds1), boxLayout(cds2)],
    },
  }
}

describe('collectRenderData peptide overlay', () => {
  it('maps the protein onto CDS exons, splitting a codon at the exon boundary', () => {
    const { layout } = twoExonTranscript()
    const result = collect(layout, {
      peptideDataMap: new Map([['tx1', { protein: 'MFK' }]]),
    })

    const overlay = result.aminoAcidOverlay!
    expect(overlay).toBeDefined()

    // codon0 (M) is a full triplet entirely within exon 1
    expect(overlay).toContainEqual(
      expect.objectContaining({
        aminoAcid: 'M',
        proteinIndex: 0,
        startBp: 100,
        endBp: 103,
        isStopOrNonTriplet: false,
      }),
    )
    // codon1 (F) is split: 1 base in exon 1, 2 bases in exon 2 — both partial
    const codon1 = overlay.filter(a => a.proteinIndex === 1)
    expect(codon1).toHaveLength(2)
    expect(codon1.every(a => a.isStopOrNonTriplet)).toBe(true)
    expect(codon1.map(a => [a.startBp, a.endBp]).sort()).toEqual([
      [103, 104],
      [200, 202],
    ])
    // codon2 (K) is a full triplet entirely within exon 2
    expect(overlay).toContainEqual(
      expect.objectContaining({
        aminoAcid: 'K',
        proteinIndex: 2,
        startBp: 202,
        endBp: 205,
        isStopOrNonTriplet: false,
      }),
    )
  })

  it('flags a transl_except residue in the overlay so it can be highlighted', () => {
    const { layout } = twoExonTranscript()
    const result = collect(layout, {
      peptideDataMap: new Map([
        ['tx1', { protein: 'MFK', translExceptIndices: new Set([2]) }],
      ]),
    })
    const overlay = result.aminoAcidOverlay!
    expect(overlay.find(a => a.proteinIndex === 2)!.isTranslExcept).toBe(true)
    expect(
      overlay.filter(a => a.proteinIndex !== 2).every(a => !a.isTranslExcept),
    ).toBe(true)
  })

  it('emits no amino-acid overlay when the transcript has no peptide data', () => {
    const { layout } = twoExonTranscript()
    const result = collect(layout)
    expect(result.aminoAcidOverlay).toBeUndefined()
  })

  // The repeated CDS row dedupedSortedCDS exists for (Gencode v36). It dedupes
  // the residues, but the layout keeps BOTH rows, and both resolve the same
  // `start-end` entry — so each residue used to be drawn twice: two stacked
  // rects, two overlay items for the hover and the codon hit test to walk, and
  // two identical <text> runs in an SVG export.
  it('draws a repeated CDS row once, not once per copy', () => {
    const cdsA = mockFeature({ type: 'CDS', id: 'cdsA', start: 100, end: 109 })
    const cdsDup = mockFeature({
      type: 'CDS',
      id: 'cdsB',
      start: 100,
      end: 109,
    })
    const mRNA = mockFeature({
      type: 'mRNA',
      id: 'tx1',
      start: 100,
      end: 109,
      subfeatures: [cdsA, cdsDup],
    })
    const result = collect(
      {
        feature: mRNA,
        glyphType: 'ProcessedTranscript',
        y: 0,
        height: 10,
        children: [boxLayout(cdsA), boxLayout(cdsDup)],
      },
      { peptideDataMap: new Map([['tx1', { protein: 'MFK' }]]) },
    )
    // 9 coding bases, so 3 codons — and one rect apiece, with no leftover box
    // rect from the skipped copy painted over them.
    expect(result.aminoAcidOverlay).toHaveLength(3)
    expect(result.rectYs).toHaveLength(3)
  })
})

// Viral polyprotein: gene → one CDS (the whole ORF) → mature_protein_region
// children. The gene routes to Subfeatures, the CDS to MatureProteinRegion;
// protein is keyed by the CDS id (each polyprotein CDS is its own reading
// frame, see findTranscriptsWithCDS). Each region becomes a stacked row.
function polyproteinLayout(
  cdsStart: number,
  cdsEnd: number,
  regions: { start: number; end: number }[],
  strand = 1,
) {
  const matures = regions.map((r, i) =>
    mockFeature({
      type: 'mature_protein_region_of_CDS',
      id: `mp${i}`,
      start: r.start,
      end: r.end,
      strand,
    }),
  )
  const cds = mockFeature({
    type: 'CDS',
    id: 'cds1',
    start: cdsStart,
    end: cdsEnd,
    strand,
    subfeatures: matures,
  })
  const gene = mockFeature({
    type: 'gene',
    id: 'g1',
    start: cdsStart,
    end: cdsEnd,
    strand,
    subfeatures: [cds],
  })
  const matureLayout: FeatureLayout = {
    feature: cds,
    glyphType: 'MatureProteinRegion',
    y: 0,
    height: regions.length * 10,
    children: matures.map((m, i) => ({ ...boxLayout(m), y: i * 10 })),
  }
  return {
    layout: {
      feature: gene,
      glyphType: 'Subfeatures' as const,
      y: 0,
      height: matureLayout.height,
      children: [matureLayout],
    },
  }
}

describe('collectRenderData polyprotein mature-peptide overlay', () => {
  it('clips the ORF translation to each cleavage-product region', () => {
    // CDS 100-118 = 6 codons (MFKLST); two regions of 3 codons each
    const { layout } = polyproteinLayout(100, 118, [
      { start: 100, end: 109 },
      { start: 109, end: 118 },
    ])
    const result = collect(layout, {
      colorByCDS: true,
      peptideDataMap: new Map([['cds1', { protein: 'MFKLST' }]]),
    })

    const overlay = result.aminoAcidOverlay!
    expect(overlay).toBeDefined()
    const topRow = overlay.filter(a => a.topPx === 0).map(a => a.aminoAcid)
    const lowerRow = overlay.filter(a => a.topPx === 10).map(a => a.aminoAcid)
    expect(topRow.sort()).toEqual(['F', 'K', 'M'])
    expect(lowerRow.sort()).toEqual(['L', 'S', 'T'])
  })

  // Real enterovirus shape: VP0 (the precursor) overlaps its own cleavage
  // products VP4 and VP2, all siblings under the CDS. Each row independently
  // shows the residues it covers — VP0 shows all six, VP4/VP2 their halves.
  it('shows residues independently for an overlapping precursor and its products', () => {
    const { layout } = polyproteinLayout(100, 118, [
      { start: 100, end: 118 }, // VP0 precursor (spans both)
      { start: 100, end: 109 }, // VP4
      { start: 109, end: 118 }, // VP2
    ])
    const result = collect(layout, {
      colorByCDS: true,
      peptideDataMap: new Map([['cds1', { protein: 'MFKLST' }]]),
    })

    const overlay = result.aminoAcidOverlay!
    const byRow = (y: number) =>
      overlay
        .filter(a => a.topPx === y)
        .map(a => a.aminoAcid)
        .sort()
    expect(byRow(0)).toEqual(['F', 'K', 'L', 'M', 'S', 'T']) // VP0
    expect(byRow(10)).toEqual(['F', 'K', 'M']) // VP4
    expect(byRow(20)).toEqual(['L', 'S', 'T']) // VP2
  })

  // The CDS spans the stop codon (118-121) but no mature region covers it, so
  // the stop is excluded from every row — it is not part of any mature peptide.
  it('excludes the trailing stop codon from every region', () => {
    const { layout } = polyproteinLayout(100, 121, [{ start: 100, end: 118 }])
    const result = collect(layout, {
      colorByCDS: true,
      peptideDataMap: new Map([['cds1', { protein: 'MFKLST*' }]]),
    })
    const overlay = result.aminoAcidOverlay!
    expect(overlay.map(a => a.aminoAcid).sort()).toEqual([
      'F',
      'K',
      'L',
      'M',
      'S',
      'T',
    ])
    expect(overlay.some(a => a.aminoAcid === '*')).toBe(false)
  })

  // On the - strand the protein's N-terminus (M) is at the highest genomic
  // coordinate; clipping is purely genomic, so each region still gets the codons
  // that physically fall within it regardless of translation direction.
  it('clips by genomic position on the - strand', () => {
    const { layout } = polyproteinLayout(
      100,
      118,
      [
        { start: 100, end: 109 },
        { start: 109, end: 118 },
      ],
      -1,
    )
    const result = collect(layout, {
      colorByCDS: true,
      peptideDataMap: new Map([['cds1', { protein: 'MFKLST' }]]),
    })
    const byRow = (y: number) =>
      result
        .aminoAcidOverlay!.filter(a => a.topPx === y)
        .map(a => a.aminoAcid)
        .sort()
    // codons T(100) S(103) L(106) fall in the low region; K(109) F(112) M(115)
    // in the high region
    expect(byRow(0)).toEqual(['L', 'S', 'T'])
    expect(byRow(10)).toEqual(['F', 'K', 'M'])
  })

  it('emits no amino-acid overlay when peptide data is absent', () => {
    const { layout } = polyproteinLayout(100, 118, [{ start: 100, end: 118 }])
    const result = collect(layout, { colorByCDS: true })
    expect(result.aminoAcidOverlay).toBeUndefined()
  })
})

describe('collectRenderData tooltip (mouseover slot)', () => {
  it('evaluates a custom mouseover jexl override against the feature', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const cfg = mockDisplayConfig({
      mouseover: `jexl:"score: "+get(feature,'id')`,
    })
    const result = collect(boxLayout(feature), { config: cfg })
    expect(result.flatbushItems[0]!.tooltip).toBe('score: g1')
  })

  it('honors a plain (non-jexl) mouseover string', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const cfg = mockDisplayConfig({ mouseover: 'static text' })
    const result = collect(boxLayout(feature), { config: cfg })
    expect(result.flatbushItems[0]!.tooltip).toBe('static text')
  })

  it('degrades to the feature name when a custom mouseover jexl throws', () => {
    const feature = mockFeature({ type: 'm6A', id: 'm1', start: 0, end: 50 })
    // references a jexl function not registered in this instance, which throws
    const cfg = mockDisplayConfig({
      mouseover: `jexl:qvscore(get(feature,'identificationqv'))`,
    })
    const result = collect(boxLayout(feature), { config: cfg })
    expect(result.flatbushItems[0]!.tooltip).toBe('m1')
  })

  // An attribute that is present but empty comes back as null, not undefined —
  // a VCF INFO key, a JSON `null` — and jexl hands it straight through. Rendered
  // with String() that put the word "null" over the feature.
  it('degrades to the feature name when a custom mouseover jexl reads a null attribute', () => {
    const feature = mockFeature({
      type: 'gene',
      id: 'g1',
      start: 0,
      end: 50,
      attributes: { note: null },
    })
    const cfg = mockDisplayConfig({ mouseover: `jexl:get(feature,'note')` })
    const result = collect(boxLayout(feature), { config: cfg })
    expect(result.flatbushItems[0]!.tooltip).toBe('g1')
  })

  it('the default slot resolves to the feature id when there is no name', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const result = collect(boxLayout(feature))
    expect(result.flatbushItems[0]!.tooltip).toBe('g1')
  })

  it('top-level feature tooltip is the single hover source (subfeatures carry no tooltip)', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ mouseover: `jexl:get(feature,'id')` })
    const result = collect(layout, { config: cfg })
    expect(result.flatbushItems[0]!.tooltip).toBe('tx1')
    // subfeatures no longer carry their own tooltip — hover unifies on the
    // top-level feature's resolved mouseover
    expect(result.subfeatureInfos.every(s => !('tooltip' in s))).toBe(true)
  })
})

describe('collectRenderData intron chevrons', () => {
  // twoExonTranscript has exons 100-104 and 200-205, so a single intron line
  // spans the 104-200 gap. The line's `direction` drives chevron rendering.
  it('sets intron line direction to the strand when chevrons are enabled', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ displayDirectionalChevrons: true })
    const result = collect(layout, { config: cfg })
    expect([...result.lineDirections]).toEqual([1])
  })

  it('zeroes intron line direction when chevrons are disabled', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ displayDirectionalChevrons: false })
    const result = collect(layout, { config: cfg })
    expect([...result.lineDirections]).toEqual([0])
  })
})

// gene → two mRNA transcripts, each with two CDS exons. The gene routes to
// Subfeatures; each transcript to ProcessedTranscript stacked at its own y. This
// pins the emit behavior of the stacked-transcript path: exon rects and intron
// lines shifted to each transcript's offset, one strand arrow per transcript
// (transcripts self-emit arrows regardless of nesting), and a subfeatureInfo per
// transcript parented to the gene.
function geneWithTwoTranscripts() {
  function transcript(id: string, base: number, topPx: number) {
    const cds1 = mockFeature({
      type: 'CDS',
      id: `${id}-cds1`,
      start: base,
      end: base + 10,
    })
    const cds2 = mockFeature({
      type: 'CDS',
      id: `${id}-cds2`,
      start: base + 30,
      end: base + 40,
    })
    const mRNA = mockFeature({
      type: 'mRNA',
      id,
      start: base,
      end: base + 40,
      subfeatures: [cds1, cds2],
    })
    return {
      feature: mRNA,
      glyphType: 'ProcessedTranscript' as const,
      y: topPx,
      height: 10,
      children: [
        { ...boxLayout(cds1), y: 0 },
        { ...boxLayout(cds2), y: 0 },
      ],
    }
  }
  const tx1 = transcript('tx1', 100, 0)
  const tx2 = transcript('tx2', 100, 15)
  const gene = mockFeature({
    type: 'gene',
    id: 'g1',
    start: 100,
    end: 140,
    subfeatures: [tx1.feature, tx2.feature],
  })
  return {
    feature: gene,
    glyphType: 'Subfeatures' as const,
    y: 0,
    height: 25,
    children: [tx1, tx2],
  }
}

describe('collectRenderData stacked-transcript (Subfeatures) emit', () => {
  it('emits exons, introns, and one arrow per transcript at its stacked offset', () => {
    const layout = geneWithTwoTranscripts()
    const result = collect(layout)

    // four exon rects (two per transcript)
    expect(result.rectPositions.length).toBe(4 * 2)
    // one intron line per transcript, at each transcript's mid-height offset
    expect([...result.lineYs]).toEqual([5, 20])
    // one strand arrow per transcript, offset to its row center
    expect([...result.arrowYs]).toEqual([5, 20])
    expect(result.arrowXs.length).toBe(2)
    // each transcript registered as a subfeature parented to the gene
    expect(result.subfeatureInfos.map(s => s.featureId)).toEqual(['tx1', 'tx2'])
    expect(result.subfeatureInfos.every(s => s.parentFeatureId === 'g1')).toBe(
      true,
    )
    expect(result.subfeatureInfos.map(s => s.topPx)).toEqual([0, 15])
  })

  it('registers a bare leaf child of a stacked gene as a hoverable subfeature', () => {
    // gene with a transcript (makes it Subfeatures) plus a bare feature with no
    // subfeatures (a Box child). The leaf must become its own subfeatureInfo
    // parented to the gene, not just a rect with hover falling back to the gene.
    const cds = mockFeature({ type: 'CDS', id: 'c1', start: 100, end: 140 })
    const mRNA = mockFeature({
      type: 'mRNA',
      id: 'tx1',
      start: 100,
      end: 140,
      subfeatures: [cds],
    })
    const leaf = mockFeature({
      type: 'regulatory_region',
      id: 'reg1',
      start: 150,
      end: 170,
    })
    const gene = mockFeature({
      type: 'gene',
      id: 'g1',
      start: 100,
      end: 170,
      subfeatures: [mRNA, leaf],
    })
    const layout: FeatureLayout = {
      feature: gene,
      glyphType: 'Subfeatures',
      y: 0,
      height: 25,
      children: [
        {
          feature: mRNA,
          glyphType: 'ProcessedTranscript',
          y: 0,
          height: 10,
          children: [{ ...boxLayout(cds), y: 0 }],
        },
        { ...boxLayout(leaf), y: 15 },
      ],
    }
    const result = collect(layout)

    const leafInfo = result.subfeatureInfos.find(s => s.featureId === 'reg1')
    expect(leafInfo).toMatchObject({
      parentFeatureId: 'g1',
      type: 'regulatory_region',
      topPx: 15,
    })
  })

  // `Box` is a self-labeling glyph (SELF_LABELING_GLYPHS), so a leaf child of a
  // gene spends its own `below` label row and `memoizeChildLayouts` marks it
  // `ownsLabelRow`. The parent's `labelRows` counts that row, and
  // `applyLayoutToRegion` is what turns the flag into height — so a leaf that
  // arrives here without it gets a hit box one label row short of the row the
  // packer reserved for it, and the label under it resolves to the gene.
  it("carries a bare leaf child's own below-label row into its hit box", () => {
    const leaf = mockFeature({
      type: 'regulatory_region',
      id: 'reg1',
      start: 150,
      end: 170,
      attributes: { name: 'reg1' },
    })
    const gene = mockFeature({
      type: 'gene',
      id: 'g1',
      start: 100,
      end: 170,
      subfeatures: [leaf],
    })
    const layout: FeatureLayout = {
      feature: gene,
      glyphType: 'Subfeatures',
      y: 0,
      height: 10,
      children: [{ ...boxLayout(leaf), y: 0, ownsLabelRow: true }],
    }
    const result = collect(layout, {
      config: { ...config, subfeatureLabels: 'below' },
    })

    expect(
      result.subfeatureInfos.find(s => s.featureId === 'reg1'),
    ).toMatchObject({ ownsLabelRow: true })
  })

  it('parents a container-inside-a-container to the record root, not the container', () => {
    // Three generic levels — a match with match_parts that themselves have
    // parts, which nests one Subfeatures glyph inside another. `parentFeatureId`
    // means "the top-level feature id" to everything that reads it: it gates
    // `resolveSubfeature`'s pairing, it is the only id GetCanvasFeatureDetails
    // resolves, and the highlight sweep pins by it. Attributing the grandchild
    // to the intermediate container instead left it drawn, labelled, and
    // impossible to hover, select or right-click.
    const grandchild = mockFeature({
      type: 'match_part',
      id: 'part1',
      start: 100,
      end: 120,
    })
    const child = mockFeature({
      type: 'match',
      id: 'inner',
      start: 100,
      end: 130,
      subfeatures: [grandchild],
    })
    const root = mockFeature({
      type: 'match',
      id: 'outer',
      start: 100,
      end: 130,
      subfeatures: [child],
    })
    const layout: FeatureLayout = {
      feature: root,
      glyphType: 'Subfeatures',
      y: 0,
      height: 20,
      children: [
        {
          feature: child,
          glyphType: 'Subfeatures',
          y: 0,
          height: 20,
          children: [{ ...boxLayout(grandchild), y: 10 }],
        },
      ],
    }
    const result = collect(layout)

    // only the leaf registers — a container glyph draws no primitives of its
    // own and so has nothing to be hovered by — and it names the root
    expect(result.subfeatureInfos.map(s => s.featureId)).toEqual(['part1'])
    expect(result.subfeatureInfos[0]!.parentFeatureId).toBe('outer')
  })
})

describe('collectRenderData collapsed-gene label + hit-box anchor', () => {
  // A gene spanning 100..2500 with two equal-coding isoforms: tx0 at 100..500
  // (CDS 100..200) and tx1 at 1100..1500 (CDS 1100..1200). longestCoding breaks
  // the coding-length tie toward the later isoform (tx1), so the rendered glyph
  // begins at 1100 — far right of the gene's own start (100). This reproduces
  // the DPP6 case where the label floated left of the visible transcript.
  function collapsedGeneLayout() {
    const makeTx = (i: number) => {
      const cds = mockFeature({
        type: 'CDS',
        id: `cds${i}`,
        start: 100 + i * 1000,
        end: 200 + i * 1000,
      })
      return mockFeature({
        type: 'mRNA',
        id: `tx${i}`,
        start: 100 + i * 1000,
        end: 500 + i * 1000,
        subfeatures: [cds],
      })
    }
    return mockFeature({
      type: 'gene',
      id: 'DPP6',
      start: 100,
      end: 2500,
      subfeatures: [makeTx(0), makeTx(1)],
    })
  }

  const labelConfig = (geneGlyphMode: 'auto' | 'all' | 'longestCoding') =>
    mockDisplayConfig({
      geneGlyphMode,
      labels: { name: `jexl:get(feature,'id')`, description: '' },
    })

  it('anchors the label + hit box to the selected transcript when collapsed', () => {
    const cfg = labelConfig('longestCoding')
    const layout = layoutSubfeatures({
      feature: collapsedGeneLayout(),
      config: cfg,
    })
    expect(layout.isoformsCollapsed).toBe(true)

    const result = collect(layout, {
      regionEnd: Number.MAX_SAFE_INTEGER,
      config: cfg,
    })

    const label = result.floatingLabelsData.get('DPP6')
    expect(label).toBeDefined()
    // not the gene start (100) — the selected transcript's extent
    expect(label!.minX).toBe(1100)
    expect(label!.maxX).toBe(1500)

    const hit = result.flatbushItems.find(i => i.featureId === 'DPP6')
    expect(hit).toMatchObject({ startBp: 1100, endBp: 1500 })
  })

  it('keeps the full gene extent when not collapsed (all mode)', () => {
    const cfg = labelConfig('all')
    const layout = layoutSubfeatures({
      feature: collapsedGeneLayout(),
      config: cfg,
    })
    expect(layout.isoformsCollapsed).toBeFalsy()

    const result = collect(layout, {
      regionEnd: Number.MAX_SAFE_INTEGER,
      config: cfg,
    })

    const label = result.floatingLabelsData.get('DPP6')
    expect(label!.minX).toBe(100)
    expect(label!.maxX).toBe(2500)
  })

  // The overlay skips its whole per-feature walk on these, so a kind reported
  // absent that was actually emitted loses a label outright.
  it('bakes which label kinds the region emitted', () => {
    const cfg = labelConfig('all')
    const result = collect(
      layoutSubfeatures({ feature: collapsedGeneLayout(), config: cfg }),
      { regionEnd: Number.MAX_SAFE_INTEGER, config: cfg },
    )
    const emitted = { name: false, description: false, subfeature: false }
    for (const label of result.floatingLabelsData.values()) {
      emitted.name ||= !!label.nameLabel
      emitted.description ||= !!label.descriptionLabel
      emitted.subfeature ||= !!label.subfeatureLabel
    }
    expect(result.labelKinds).toEqual(emitted)
    expect(emitted.name).toBe(true)
  })
})

describe('collectRenderData color-slot robustness', () => {
  // A per-feature color jexl that throws (references an unregistered function)
  // must not fail the whole track render — it degrades to a visible magenta
  // sentinel per feature, mirroring the mouseover/labels slots.
  it('degrades to magenta when a per-feature color jexl throws', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const cfg = mockDisplayConfig({
      color: `jexl:qvcolor(get(feature,'missing'))`,
    })
    const result = collect(boxLayout(feature), { config: cfg })
    expect([...result.rectColors]).toEqual([cssColorToABGR('magenta')])
  })
})

// Fade eligibility is recorded once per FEATURE on the flatbush item. The
// per-rect `rectDensityFade` array is allocated here but valued by the
// main-thread layout, so it is deliberately all-zero on the way out of the
// worker, so asserting on it here would be asserting on nothing.
describe('collectRenderData density-fade eligibility', () => {
  it('marks whole-feature box glyphs (variants, plain BED) fade-eligible', () => {
    const feature = mockFeature({
      type: 'SNV',
      id: 'v1',
      start: 100,
      end: 101,
    })
    const result = collect(boxLayout(feature))
    expect(result.flatbushItems.map(i => i.densityFade)).toEqual([true])
    expect([...result.rectDensityFade]).toEqual([0])
  })

  it('never marks a transcript (CDS/exon container) fade-eligible', () => {
    const { layout } = twoExonTranscript()
    const result = collect(layout)
    expect(result.flatbushItems.length).toBeGreaterThan(0)
    expect(result.flatbushItems.every(i => !i.densityFade)).toBe(true)
  })
})

// Transcript coordinates ride on the hit-test entries so the hover can name the
// exon and HGVS position under the cursor: on the transcript's SubfeatureInfo
// when it sits under a gene, on the feature's own FlatbushItem when it stands
// alone.
describe('collectRenderData transcript coords', () => {
  const exon = (id: string, start: number, end: number) =>
    mockFeature({ type: 'exon', id, start, end })

  function transcript(id: string) {
    return mockFeature({
      type: 'mRNA',
      id,
      start: 0,
      end: 500,
      subfeatures: [
        exon(`${id}-e1`, 0, 100),
        exon(`${id}-e2`, 200, 300),
        exon(`${id}-e3`, 400, 500),
        mockFeature({ type: 'CDS', id: `${id}-cds`, start: 50, end: 450 }),
      ],
    })
  }

  it('puts the transcript coords on its subfeature entry under a gene', () => {
    const gene = mockFeature({
      type: 'gene',
      id: 'g1',
      start: 0,
      end: 500,
      subfeatures: [transcript('tx1')],
    })
    const result = collect(findGlyph(gene, config)({ feature: gene, config }))
    const info = result.subfeatureInfos.find(s => s.featureId === 'tx1')
    expect(info!.transcript).toEqual({
      exons: [0, 100, 200, 300, 400, 500],
      strand: 1,
      coding: [50, 450],
    })
  })

  it('puts them on the feature entry for a standalone transcript', () => {
    const tx = transcript('tx1')
    const result = collect(findGlyph(tx, config)({ feature: tx, config }))
    const item = result.flatbushItems.find(i => i.featureId === 'tx1')
    expect(item!.transcript).toEqual({
      exons: [0, 100, 200, 300, 400, 500],
      strand: 1,
      coding: [50, 450],
    })
  })
})
