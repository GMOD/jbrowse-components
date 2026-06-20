import { createJBrowseTheme } from '@jbrowse/core/ui'

import { collectRenderData } from './collectRenderData.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  id: string
  start: number
  end: number
  strand?: number
  phase?: number
  subfeatures?: Feature[]
}): Feature {
  const { strand = 1, subfeatures = [], ...rest } = opts
  const map: Record<string, unknown> = { strand, subfeatures, ...rest }
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
    totalLayoutHeight: 10,
    children: [],
  }
}

const theme = createJBrowseTheme()
const config = mockDisplayConfig({ color: '#cccc99' })

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
      totalLayoutHeight: 10,
      children: [boxLayout(cds1), boxLayout(cds2)],
    },
  }
}

describe('collectRenderData peptide overlay', () => {
  it('maps the protein onto CDS exons, splitting a codon at the exon boundary', () => {
    const { layout } = twoExonTranscript()
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      false,
      new Map([['tx1', { protein: 'MFK' }]]),
    )

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

  it('emits no amino-acid overlay when the transcript has no peptide data', () => {
    const { layout } = twoExonTranscript()
    const result = collectRenderData([layout], 0, 1000, config, theme, false)
    expect(result.aminoAcidOverlay).toBeUndefined()
  })
})

// Viral polyprotein: gene → one CDS (the whole ORF) → mature_protein_region
// children. The gene routes to Subfeatures, the CDS to MatureProteinRegion;
// protein is keyed by the gene id. Each region becomes a stacked row.
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
    totalLayoutHeight: regions.length * 10,
    children: matures.map((m, i) => ({ ...boxLayout(m), y: i * 10 })),
  }
  return {
    layout: {
      feature: gene,
      glyphType: 'Subfeatures' as const,
      y: 0,
      height: matureLayout.height,
      totalLayoutHeight: matureLayout.height,
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
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      true,
      new Map([['g1', { protein: 'MFKLST' }]]),
    )

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
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      true,
      new Map([['g1', { protein: 'MFKLST' }]]),
    )

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
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      true,
      new Map([['g1', { protein: 'MFKLST*' }]]),
    )
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
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      true,
      new Map([['g1', { protein: 'MFKLST' }]]),
    )
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
    const result = collectRenderData([layout], 0, 1000, config, theme, true)
    expect(result.aminoAcidOverlay).toBeUndefined()
  })
})

describe('collectRenderData tooltip (mouseover slot)', () => {
  it('evaluates a custom mouseover jexl override against the feature', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const cfg = mockDisplayConfig({
      mouseover: `jexl:"score: "+get(feature,'id')`,
    })
    const result = collectRenderData(
      [boxLayout(feature)],
      0,
      1000,
      cfg,
      theme,
      false,
    )
    expect(result.flatbushItems[0]!.tooltip).toBe('score: g1')
  })

  it('honors a plain (non-jexl) mouseover string', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const cfg = mockDisplayConfig({ mouseover: 'static text' })
    const result = collectRenderData(
      [boxLayout(feature)],
      0,
      1000,
      cfg,
      theme,
      false,
    )
    expect(result.flatbushItems[0]!.tooltip).toBe('static text')
  })

  it('degrades to the feature name when a custom mouseover jexl throws', () => {
    const feature = mockFeature({ type: 'm6A', id: 'm1', start: 0, end: 50 })
    // references a jexl function not registered in this instance, which throws
    const cfg = mockDisplayConfig({
      mouseover: `jexl:qvscore(get(feature,'identificationqv'))`,
    })
    const result = collectRenderData(
      [boxLayout(feature)],
      0,
      1000,
      cfg,
      theme,
      false,
    )
    expect(result.flatbushItems[0]!.tooltip).toBe('m1')
  })

  it('the default slot resolves to the feature id when there is no name', () => {
    const feature = mockFeature({ type: 'gene', id: 'g1', start: 0, end: 50 })
    const result = collectRenderData(
      [boxLayout(feature)],
      0,
      1000,
      config,
      theme,
      false,
    )
    expect(result.flatbushItems[0]!.tooltip).toBe('g1')
  })

  it('top-level feature tooltip is the single hover source (subfeatures carry no tooltip)', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ mouseover: `jexl:get(feature,'id')` })
    const result = collectRenderData([layout], 0, 1000, cfg, theme, false)
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
    const result = collectRenderData([layout], 0, 1000, cfg, theme, false)
    expect([...result.lineDirections]).toEqual([1])
  })

  it('zeroes intron line direction when chevrons are disabled', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ displayDirectionalChevrons: false })
    const result = collectRenderData([layout], 0, 1000, cfg, theme, false)
    expect([...result.lineDirections]).toEqual([0])
  })
})
