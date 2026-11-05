import { resolvePalette } from '@jbrowse/core/ui/palette'
import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import FeaturesPlugin, { isLinearBasicDisplay } from '@jbrowse/plugin-features'
import { isPlacedRow } from '@jbrowse/plugin-features/band'
import GFF3Plugin from '@jbrowse/plugin-gff3'

import { createTablesEngine } from '../index.ts'
import { GFF3 } from '../volvox.fixture.ts'
import { standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { FeatureTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-features'

const FEATURE_DECISIONS = [
  'rows',
  'transcripts',
  'truncated',
  'labels',
  'sections',
  'legend',
] as const

type FeatureDecision = (typeof FEATURE_DECISIONS)[number]

interface Span {
  id: string
  top: number
  bottom: number
}

interface Label {
  id: string
  text: string
  y: number
}

const byId = (a: Span, b: Span) => a.id.localeCompare(b.id)

const byIdAndText = (a: Label, b: Label) =>
  a.id.localeCompare(b.id) || a.text.localeCompare(b.text)

const engine = createTablesEngine()

/**
 * The feature display beside `engine.features` over volvox's GFF3 at
 * `bpPerPx`: each placed feature's row span, the transcripts drawn under them
 * (what the gene glyph mode and the fit ladder's isoform rung keep), the
 * features the packer could not place, the labels drawn (the density gate, the
 * fit ladder and the label settings together), the facet's sections and the
 * color key.
 */
function featureParity(
  bpPerPx: number,
  region: TablesRegion = GFF3.region,
): ParityAdapter<
  Record<string, unknown>,
  LinearBasicDisplayModel,
  FeatureTables,
  FeatureDecision
> {
  return {
    decisionNames: FEATURE_DECISIONS,
    buildModel: async display => {
      const { display: model, dispose } =
        await standUpDisplay<LinearBasicDisplayModel>({
          plugins: [new FeaturesPlugin(), new GFF3Plugin()],
          track: { type: 'FeatureTrack', adapter: GFF3.adapterConfig },
          displayType: 'LinearBasicDisplay',
          isDisplay: isLinearBasicDisplay,
          displayConfig: display,
          region,
          contigLength: 50_001,
          bpPerPx,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.features({ ...GFF3, region, bpPerPx, display }),
    modelDecisions: m => {
      const rows = new Map<string, Span>()
      const transcripts = new Map<string, Span>()
      const onScreen = m.onScreenFeatureIds
      const drawnLabels = m.floatingLabels(resolvePalette())
      const labelled = new Set(drawnLabels.map(l => l.featureId))
      for (const data of m.laidOutDataMap.values()) {
        for (const s of data.subfeatureInfos) {
          if (labelled.has(s.featureId)) {
            labelled.add(s.parentFeatureId)
          }
        }
      }
      for (const data of m.laidOutDataMap.values()) {
        for (const item of data.flatbushItems) {
          if (
            isPlacedRow(item.topPx) &&
            (onScreen?.has(item.featureId) || labelled.has(item.featureId))
          ) {
            rows.set(item.featureId, {
              id: item.featureId,
              top: item.topPx,
              bottom: item.bottomPx,
            })
          }
        }
      }
      for (const data of m.laidOutDataMap.values()) {
        for (const s of data.subfeatureInfos) {
          if (rows.has(s.parentFeatureId)) {
            transcripts.set(s.featureId, {
              id: s.featureId,
              top: s.topPx,
              bottom: s.bottomPx,
            })
          }
        }
      }
      const key = colorKeyTables(m.colorScales)
      return {
        rows: [...rows.values()].sort(byId),
        transcripts: [...transcripts.values()].sort(byId),
        truncated: m.truncatedFeatureCount,
        labels: drawnLabels
          .map(l => ({ id: l.featureId ?? '', text: l.text, y: l.y }))
          .sort(byIdAndText),
        sections: m.facet
          ? m.groupSections.map(s => ({ key: s.key, label: s.label }))
          : [{ key: '', label: '' }],
        legend: {
          label: key.legend.label,
          color: key.legend.color,
          title: key.legendTitle,
          ramps: key.ramps,
        },
      }
    },
    exportDecisions: t => ({
      rows: t.features.id
        .map((id, i) => ({
          id,
          top: t.features.top[i]!,
          bottom: t.features.bottom[i]!,
        }))
        .sort(byId),
      transcripts: t.subfeatures.id
        .map((id, i) => ({
          id,
          top: t.subfeatures.top[i]!,
          bottom: t.subfeatures.bottom[i]!,
        }))
        .sort(byId),
      truncated: t.truncated,
      labels: t.labels.text
        .map((text, i) => {
          const sub = t.labels.subfeature[i]!
          return {
            id:
              sub >= 0
                ? t.subfeatures.id[sub]!
                : t.features.id[t.labels.feature[i]!]!,
            text,
            y: t.labels.y[i]!,
          }
        })
        .sort(byIdAndText),
      sections: t.sections.key.map((key, i) => ({
        key,
        label: t.sections.label[i],
      })),
      legend: {
        ...t.legend,
        title: t.legendTitle,
        ramps: t.ramps,
      },
    }),
  }
}

const GROW = { heightMode: 'grow' }

describe("volvox's genes at 50 bp/px", () => {
  parityCases(featureParity(50), [
    { name: 'defaults', config: {} },
    { name: 'grow', config: GROW },
    { name: 'a short fit track', config: { height: 40 } },
    {
      name: 'a short fixed track',
      config: { heightMode: 'fixed', height: 40 },
    },
    { name: 'compact', config: { ...GROW, displayMode: 'compact' } },
    { name: 'collapsed', config: { displayMode: 'collapsed' } },
    {
      name: 'descriptions on',
      config: { ...GROW, labels: { description: { show: true } } },
    },
    {
      name: 'names off',
      config: { ...GROW, labels: { name: { show: false } } },
    },
    {
      name: 'subfeature labels below',
      config: {
        ...GROW,
        labels: { subfeatures: { show: true, placement: 'below' } },
      },
    },
    {
      name: 'representative transcripts',
      config: { ...GROW, geneGlyphMode: 'representative' },
    },
    { name: 'every transcript', config: { geneGlyphMode: 'all' } },
    {
      name: 'encoding.color by type',
      config: { ...GROW, encoding: { color: { field: 'type' } } },
    },
    { name: 'facet by strand', config: { ...GROW, facet: 'strand' } },
    {
      name: 'facet by strand, one hidden',
      config: { ...GROW, facet: { field: 'strand', hidden: ['-1'] } },
    },
    {
      name: 'facet and color by type',
      config: { facet: 'type', encoding: { color: { field: 'type' } } },
    },
  ])
})

describe("volvox's genes at 250 bp/px, past the label density limit", () => {
  parityCases(featureParity(250), [
    { name: 'defaults', config: {} },
    { name: 'grow', config: GROW },
    {
      name: 'descriptions on',
      config: { ...GROW, labels: { description: { show: true } } },
    },
    {
      name: 'facet by strand, one hidden',
      config: { ...GROW, facet: { field: 'strand', hidden: ['-1'] } },
    },
  ])
})

describe("a 10 kb window of volvox's genes, features crossing both edges", () => {
  parityCases(
    featureParity(20, { refName: 'ctgA', start: 5000, end: 15_000 }),
    [
      { name: 'defaults', config: {} },
      { name: 'grow', config: GROW },
      { name: 'a short fit track', config: { height: 40 } },
      { name: 'every transcript', config: { geneGlyphMode: 'all' } },
      {
        name: 'encoding.color by type',
        config: { ...GROW, encoding: { color: { field: 'type' } } },
      },
      { name: 'facet by strand', config: { ...GROW, facet: 'strand' } },
    ],
  )
})
