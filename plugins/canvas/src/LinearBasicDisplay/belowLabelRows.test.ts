import { resolvePalette } from '@jbrowse/core/ui/palette'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from '../RenderFeatureDataRPC/collectRenderData.ts'
import { layoutCrisprGuide } from '../RenderFeatureDataRPC/glyphs/crisprGuide.ts'
import { labelFontSize } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { layoutMatureProteinRegion } from '../RenderFeatureDataRPC/glyphs/matureProteinRegion.ts'
import { layoutRepeatRegion } from '../RenderFeatureDataRPC/glyphs/repeatRegion.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { labelColors } from './components/labelColors.ts'
import { forEachRenderedLabel } from './components/labelPositioning.ts'
import { computeLaidOutData } from './layout.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ResolvedLabel } from './components/labelPositioning.ts'
import type { LayoutRegionData } from './layoutInputs.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { subfeatures = [], ...rest } = opts
  const map: Record<string, unknown> = { strand: 1, subfeatures, ...rest }
  return {
    get: (key: string) => map[key],
    id: () => `${opts.type}-${opts.name}`,
    parent: () => undefined,
  } as unknown as Feature
}

// A gene with three named mRNAs, each a single-exon transcript — the shape that
// stacks inside one row and so the shape a `below` label row has to be reserved
// within.
function geneWithTranscripts(names: string[]) {
  return mockFeature({
    type: 'gene',
    name: 'GENE1',
    start: 100,
    end: 100 + names.length * 1000,
    subfeatures: names.map((name, i) =>
      mockFeature({
        type: 'mRNA',
        name,
        start: 100 + i * 1000,
        end: 600 + i * 1000,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            name: `${name}-cds`,
            start: 100 + i * 1000,
            end: 600 + i * 1000,
          }),
        ],
      }),
    ),
  })
}

// A polyprotein CDS whose mature_protein_region children tile the ORF — the
// other glyph that reserves a `below` label row, and the one that reserved it by
// halving its own row rather than by adding to a running offset.
function polyprotein(names: string[]) {
  return mockFeature({
    type: 'CDS',
    name: 'ORF1ab',
    start: 100,
    end: 100 + names.length * 300,
    subfeatures: names.map((name, i) =>
      mockFeature({
        type: 'mature_protein_region',
        name,
        start: 100 + i * 300,
        end: 400 + i * 300,
      }),
    ),
  })
}

// Runs the real pipeline — worker layout, worker collect, main-thread pack —
// and returns the laid-out region for one display mode.
function layoutAt(
  displayMode: DisplayMode,
  subfeatureLabels: string,
  feature = geneWithTranscripts(['mRNA-a', 'mRNA-b', 'mRNA-c']),
  glyph = layoutSubfeatures,
  extraConfig: Record<string, unknown> = {},
) {
  const config = mockDisplayConfig({
    subfeatureLabels,
    ...extraConfig,
  } as any)
  const layout = glyph({
    feature,
    config,
    jexl,
  })
  const packed = collectRenderData({
    layouts: [layout],
    regionStart: 0,
    regionEnd: 10_000,
    config,
    colorByCDS: false,
    jexl,
  })
  const raw = {
    ...packed,
    featureCount: 1,
    regionKey: 'volvox:ctgA',
  } as unknown as LayoutRegionData
  return computeLaidOutData(new Map([[0, raw]]), {
    bpPerPx: 1,
    showLabels: true,
    showDescriptions: false,
    reversedRegions: new Set<number>(),
    displayMode,
    pinnedFeatureIds: new Set<string>(),
  }).get(0)!
}

// Subfeature rows of one type, in draw order, as [top, bottom].
function rowsOfType(data: FeatureDataResult, type: string) {
  return data.subfeatureInfos
    .filter(i => i.type === type)
    .map(i => [i.topPx, i.bottomPx] as const)
    .sort((a, b) => a[0] - b[0])
}

function transcriptRows(data: FeatureDataResult) {
  return rowsOfType(data, 'mRNA')
}

// The bug this file exists for: the worker reserved the `below` label row as a
// raw LABEL_FONT_SIZE in normal-mode units, which the main thread then scaled by
// HEIGHT_MULTIPLIERS along with the geometry — while the label itself draws at
// the gentler LABEL_FONT_MULTIPLIERS. So the reserved gap came out SMALLER than
// the text (6.6px against 9.35px in compact, 3.3px against 7.7px in
// superCompact), every `below` label lay across the transcript under it, and the
// shortfall accumulated down the gene's stack.
describe('below subfeature-label rows survive compact scaling', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']

  it.each(modes)('leaves a full label line between transcripts (%s)', mode => {
    const rows = transcriptRows(layoutAt(mode, 'below'))
    expect(rows).toHaveLength(3)

    const drawnLabelPx = labelFontSize(mode)
    for (let i = 1; i < rows.length; i++) {
      // gap between one transcript's BODY bottom and the next one's top. The hit
      // box (bottomPx) already covers the label row, so measure from the body:
      // top + the body height the previous row reports.
      const gap = rows[i]![0] - rows[i - 1]![1]
      // bottomPx includes the owned label row, so a non-negative gap here means
      // the label row fits with the next transcript starting at or after it
      expect(gap).toBeGreaterThanOrEqual(0)
    }
    // and the row a label occupies is the size the label is actually drawn at
    const ownedRow = rows[0]![1] - rows[0]![0]
    const bodyOnly = transcriptRows(layoutAt(mode, 'none'))[0]!
    expect(ownedRow - (bodyOnly[1] - bodyOnly[0])).toBeCloseTo(drawnLabelPx, 5)
  })

  it('costs nothing when below-labels are off', () => {
    for (const mode of modes) {
      const withLabels = layoutAt(mode, 'below')
      const without = layoutAt(mode, 'none')
      // the label rows are the ONLY difference; with them off the pass is
      // length-zero on the wire and adds no pixels
      expect(without.rectLabelRows.length).toBe(0)
      expect(withLabels.rectLabelRows.length).toBeGreaterThan(0)
    }
  })

  // superCompact is where the old arithmetic was worst: it reserved 3.3px for a
  // 7.7px label, so each of the three transcripts lost 4.4px to its neighbour.
  it('scales the label row on label units, not on geometry units', () => {
    const compact = transcriptRows(layoutAt('compact', 'below'))
    const superCompact = transcriptRows(layoutAt('superCompact', 'below'))
    const rowOf = (rows: readonly (readonly [number, number])[]) =>
      rows[0]![1] - rows[0]![0]
    // the bodies shrink on HEIGHT_MULTIPLIERS (0.6 -> 0.3, halving), but the
    // label row shrinks only on LABEL_FONT_MULTIPLIERS (0.85 -> 0.7), so the
    // labeled row must NOT halve between the two modes
    expect(rowOf(superCompact)).toBeGreaterThan(rowOf(compact) / 2)
  })
})

// The mature-protein glyph reserved its label by HALVING the row rather than by
// adding to a running offset, so it expressed the label's share in geometry
// units too — and, because halving also halves what a full-size label lives in,
// it overflowed in NORMAL mode as well, unlike the transcript path.
describe('below label rows on the polyprotein glyph', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']

  it.each(modes)('gives each cleavage product a full label line (%s)', mode => {
    const feature = polyprotein(['nsp1', 'nsp2', 'nsp3'])
    const withLabels = layoutAt(
      mode,
      'below',
      feature,
      layoutMatureProteinRegion,
    )
    const without = layoutAt(mode, 'none', feature, layoutMatureProteinRegion)
    const labeled = rowsOfType(withLabels, 'mature_protein_region')
    const plain = rowsOfType(without, 'mature_protein_region')
    expect(labeled).toHaveLength(3)

    const drawnLabelPx = labelFontSize(mode)
    // each product's own row grows by exactly the line its label is drawn at
    for (const [i, row] of labeled.entries()) {
      const grew = row[1] - row[0] - (plain[i]![1] - plain[i]![0])
      expect(grew).toBeCloseTo(drawnLabelPx, 5)
    }
    // and consecutive products are pushed apart by that same line, so a label
    // never lands on the product under it
    for (let i = 1; i < labeled.length; i++) {
      const plainGap = plain[i]![0] - plain[i - 1]![0]
      const labeledGap = labeled[i]![0] - labeled[i - 1]![0]
      expect(labeledGap - plainGap).toBeCloseTo(drawnLabelPx, 5)
    }
  })
})

// The gene's own name label hangs off `topY + featureHeight` of its
// floatingLabelsData entry, the same extent its hit box reports. Missing the
// rows its transcripts reserve, it drew the DTU gene name across a transcript.
describe("a container's floating label clears the rows it contains", () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']
  // the gene needs a name label of its own for there to be an entry at all
  const named = {
    labels: { name: "jexl:get(feature,'name')", description: '' },
  }
  const geneLayout = (mode: DisplayMode, subfeatureLabels: string) =>
    layoutAt(
      mode,
      subfeatureLabels,
      geneWithTranscripts(['mRNA-a', 'mRNA-b', 'mRNA-c']),
      layoutSubfeatures,
      named,
    )

  it.each(modes)('matches the extent the hit box reports (%s)', mode => {
    const data = geneLayout(mode, 'below')
    const gene = data.flatbushItems.find(i => i.type === 'gene')!
    const label = data.floatingLabelsData.get(gene.featureId)!
    expect(label.featureHeight).toBeCloseTo(gene.featureHeightPx, 5)
  })

  it.each(modes)('grows by one drawn line per contained row (%s)', mode => {
    const withLabels = geneLayout(mode, 'below')
    const without = geneLayout(mode, 'none')
    const heightOf = (data: FeatureDataResult) => {
      const gene = data.flatbushItems.find(i => i.type === 'gene')!
      return data.floatingLabelsData.get(gene.featureId)!.featureHeight
    }
    expect(heightOf(withLabels) - heightOf(without)).toBeCloseTo(
      3 * labelFontSize(mode),
      5,
    )
  })
})

// EDTA / LTR_retriever-style intact transposon: the subparts share ONE row, so
// their `below` labels share one row too — the row `layoutRepeatRegion`
// reserves, since the emitter registers those children straight off the feature
// and no child layout owns a row.
function intactRetrotransposon() {
  return mockFeature({
    type: 'repeat_region',
    name: 'TE1',
    start: 100,
    end: 1100,
    subfeatures: [
      mockFeature({
        type: 'target_site_duplication',
        name: 'tsd-left',
        start: 100,
        end: 105,
      }),
      mockFeature({
        type: 'long_terminal_repeat',
        name: 'ltr-left',
        start: 105,
        end: 305,
      }),
      mockFeature({
        type: 'Copia_LTR_retrotransposon',
        name: 'internal',
        start: 105,
        end: 1095,
      }),
      mockFeature({
        type: 'long_terminal_repeat',
        name: 'ltr-right',
        start: 895,
        end: 1095,
      }),
      mockFeature({
        type: 'target_site_duplication',
        name: 'tsd-right',
        start: 1095,
        end: 1100,
      }),
    ],
  })
}

// A CrisprGuideAdapter guide: one PAM subfeature, labeled with the literal
// 'PAM' rather than a name of its own.
function crisprGuide() {
  return mockFeature({
    type: 'guide_rna',
    name: 'AAATTTAAATTTAAATTTAA',
    start: 80,
    end: 103,
    subfeatures: [
      mockFeature({ type: 'PAM', name: 'pam', start: 100, end: 103 }),
    ],
  })
}

// The two glyphs whose registered children all label into ONE row under the
// body with no child layout owning it. Until the layouts reserved that row,
// `bodyHeightPx` stopped at the feature's box and every subpart label — and the
// guide's `PAM` — drew past it into the next feature's row.
describe('the shared below-label row of the repeat and CRISPR glyphs', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']
  // both features carry a name of their own, which is the label that has to
  // clear the shared row rather than land a couple of px from it
  const named = {
    labels: { name: "jexl:get(feature,'name')", description: '' },
  }
  const region = {
    start: 0,
    end: 10_000,
    screenStartPx: 0,
    screenEndPx: 10_000,
  }

  // Every label the display draws, positioned through the production path, so
  // the top gap each kind gets is not restated here.
  function drawnLabels(data: FeatureDataResult, mode: DisplayMode) {
    const out: ResolvedLabel[] = []
    forEachRenderedLabel(
      data,
      region,
      {
        showLabels: true,
        showDescriptions: false,
        showSubfeatureLabels: true,
        fontSize: labelFontSize(mode),
        colors: labelColors(resolvePalette()),
      },
      (_featureId, labels) => out.push(...labels),
    )
    return out
  }

  function measure(
    feature: Feature,
    glyph: typeof layoutRepeatRegion,
    mode: DisplayMode,
    subfeatureLabels = 'below',
  ) {
    const data = layoutAt(mode, subfeatureLabels, feature, glyph, named)
    const labels = drawnLabels(data, mode)
    const bottoms = (kind: ResolvedLabel['kind']) =>
      labels
        .filter(l => l.kind === kind)
        .map(l => l.labelY + labelFontSize(mode))
    const item = data.flatbushItems.find(i => i.featureId === feature.id())!
    return {
      // THE reservation: the worker height scaled by the mode plus the label
      // rows it counted — `bodyHeightPx`, the one derivation the fit probe and
      // the committed pack share
      bodyBottom: item.topPx + item.featureHeightPx,
      subBottoms: bottoms('sub'),
      nameTop: Math.min(
        ...labels.filter(l => l.kind === 'name').map(l => l.labelY),
      ),
    }
  }

  const cases = [
    ['repeat_region', intactRetrotransposon, layoutRepeatRegion, 5],
    ['CRISPR guide', crisprGuide, layoutCrisprGuide, 1],
  ] as const

  describe.each(cases)('%s', (_name, makeFeature, glyph, labelCount) => {
    it.each(modes)(
      'keeps every subpart label inside bodyHeightPx (%s)',
      mode => {
        const { bodyBottom, subBottoms } = measure(makeFeature(), glyph, mode)
        expect(subBottoms).toHaveLength(labelCount)
        for (const bottom of subBottoms) {
          expect(bottom).toBeLessThanOrEqual(bodyBottom + 1e-9)
        }
        // and the reservation is spent, not merely large enough: the lowest label
        // ends exactly at the row the pack charged for
        expect(Math.max(...subBottoms)).toBeCloseTo(bodyBottom, 5)
      },
    )

    it.each(modes)('costs exactly one label line (%s)', mode => {
      const withLabels = measure(makeFeature(), glyph, mode)
      const without = measure(makeFeature(), glyph, mode, 'none')
      // one row, and spent at the LABEL font size rather than scaled with the
      // geometry — whatever the number of children labeling into it
      expect(withLabels.bodyBottom - without.bodyBottom).toBeCloseTo(
        labelFontSize(mode),
        5,
      )
      expect(without.subBottoms).toHaveLength(0)
    })

    it.each(modes)("clears the feature's own name label (%s)", mode => {
      const { subBottoms, nameTop } = measure(makeFeature(), glyph, mode)
      // The name hangs off the same extent the reservation grew, so it moves
      // down by the row instead of landing on it. Unreserved, a guide's name sat
      // 2px under its `PAM` — two 11px lines on top of each other.
      expect(nameTop).toBeGreaterThanOrEqual(Math.max(...subBottoms))
    })
  })
})
