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

function rowsOfType(data: FeatureDataResult, type: string) {
  return data.subfeatureInfos
    .filter(i => i.type === type)
    .map(i => [i.topPx, i.bottomPx] as const)
    .sort((a, b) => a[0] - b[0])
}

function transcriptRows(data: FeatureDataResult) {
  return rowsOfType(data, 'mRNA')
}

describe('below subfeature-label rows survive compact scaling', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']

  it.each(modes)('leaves a full label line between transcripts (%s)', mode => {
    const rows = transcriptRows(layoutAt(mode, 'below'))
    expect(rows).toHaveLength(3)

    const drawnLabelPx = labelFontSize(mode)
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i]![0] - rows[i - 1]![1]
      expect(gap).toBeGreaterThanOrEqual(0)
    }
    const ownedRow = rows[0]![1] - rows[0]![0]
    const bodyOnly = transcriptRows(layoutAt(mode, 'none'))[0]!
    expect(ownedRow - (bodyOnly[1] - bodyOnly[0])).toBeCloseTo(drawnLabelPx, 5)
  })

  it('costs nothing when below-labels are off', () => {
    for (const mode of modes) {
      const withLabels = layoutAt(mode, 'below')
      const without = layoutAt(mode, 'none')
      expect(without.rectLabelRows.length).toBe(0)
      expect(withLabels.rectLabelRows.length).toBeGreaterThan(0)
    }
  })

  it('scales the label row on label units, not on geometry units', () => {
    const compact = transcriptRows(layoutAt('compact', 'below'))
    const superCompact = transcriptRows(layoutAt('superCompact', 'below'))
    const rowOf = (rows: readonly (readonly [number, number])[]) =>
      rows[0]![1] - rows[0]![0]
    expect(rowOf(superCompact)).toBeGreaterThan(rowOf(compact) / 2)
  })
})

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
    for (const [i, row] of labeled.entries()) {
      const grew = row[1] - row[0] - (plain[i]![1] - plain[i]![0])
      expect(grew).toBeCloseTo(drawnLabelPx, 5)
    }
    for (let i = 1; i < labeled.length; i++) {
      const plainGap = plain[i]![0] - plain[i - 1]![0]
      const labeledGap = labeled[i]![0] - labeled[i - 1]![0]
      expect(labeledGap - plainGap).toBeCloseTo(drawnLabelPx, 5)
    }
  })
})

describe("a container's floating label clears the rows it contains", () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']
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

describe('the shared below-label row of the repeat and CRISPR glyphs', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']
  const named = {
    labels: { name: "jexl:get(feature,'name')", description: '' },
  }
  const region = {
    start: 0,
    end: 10_000,
    screenStartPx: 0,
    screenEndPx: 10_000,
  }

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
        expect(Math.max(...subBottoms)).toBeCloseTo(bodyBottom, 5)
      },
    )

    it.each(modes)('costs exactly one label line (%s)', mode => {
      const withLabels = measure(makeFeature(), glyph, mode)
      const without = measure(makeFeature(), glyph, mode, 'none')
      expect(withLabels.bodyBottom - without.bodyBottom).toBeCloseTo(
        labelFontSize(mode),
        5,
      )
      expect(without.subBottoms).toHaveLength(0)
    })

    it.each(modes)("clears the feature's own name label (%s)", mode => {
      const { subBottoms, nameTop } = measure(makeFeature(), glyph, mode)
      expect(nameTop).toBeGreaterThanOrEqual(Math.max(...subBottoms))
    })
  })
})
