import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { abgrToHex } from '@jbrowse/core/util/colorBits'
import VariantsPlugin from '@jbrowse/plugin-variants'

import { createTablesEngine } from '../index.ts'
import { BREAKENDS, DOG_SV, DOG_VCF } from '../volvox.fixture.ts'
import { VOLVOX_CONTIGS, hasDisplayType, standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { VariantTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearVariantDisplayModel } from '@jbrowse/plugin-variants'

interface VariantFixture {
  adapterConfig: Record<string, unknown>
  regions: TablesRegion[]
  contigLengths: Record<string, number>
}

/** Whether `start`-`end` reaches into the window the payload `k` draws. */
const inWindow = (
  regions: readonly TablesRegion[],
  k: string,
  start: number,
  end: number,
) => {
  const window = regions[Number(k)]
  return !!window && end > window.start && start < window.end
}

const VARIANT_DECISIONS = [
  'rows',
  'rowColors',
  'bands',
  'legend',
  'ramps',
  'rowLegend',
  'cellColors',
  'recordColors',
] as const

type VariantDecision = (typeof VARIANT_DECISIONS)[number]

const ROW_KEY = 'rows.color'

const engine = createTablesEngine()

/** Each record over `regions` as `variant color`, as the records band paints it. */
function displayRecordColors(
  m: LinearVariantDisplayModel,
  regions: readonly TablesRegion[],
) {
  const { cellData, regionRecordColors } = m
  const out: string[] = []
  for (const [k, data] of Object.entries(cellData?.perRegionCellData ?? {})) {
    const colors = regionRecordColors.get(Number(k))!
    data.featureInfo.forEach((info, f) => {
      const start = data.featurePositions[f * 2]!
      const end = data.featurePositions[f * 2 + 1]!
      if (inWindow(regions, k, start, end)) {
        out.push(`${info.featureId} ${abgrToHex(colors[f]!)}`)
      }
    })
  }
  return out
}

/**
 * Each drawn cell over `regions` as `variant row color`, in payload order:
 * the display's painted cells, its density fade dropped with the alpha.
 */
function displayCellColors(
  m: LinearVariantDisplayModel,
  regions: readonly TablesRegion[],
) {
  const { cellData, regionCellColors } = m
  const drawn = new Set(m.drawsGenotypeRows ? m.sources.map(s => s.name) : [])
  const out: string[] = []
  for (const [k, data] of Object.entries(cellData?.perRegionCellData ?? {})) {
    const colors = regionCellColors.get(Number(k))!
    for (let i = 0; i < data.numCells; i++) {
      const f = data.cellFeatureIndices[i]!
      const row = cellData!.rowNames[data.cellRowIndices[i]!]!
      const start = data.featurePositions[f * 2]!
      const end = data.featurePositions[f * 2 + 1]!
      if (drawn.has(row) && inWindow(regions, k, start, end)) {
        out.push(
          `${data.featureInfo[f]!.featureId} ${row} ${abgrToHex(colors[i]!)}`,
        )
      }
    }
  }
  return out
}

/**
 * The variant display beside `engine.variants` over one fixture: the rows
 * in order with their labels, samples and haplotypes, each row's color, the
 * facet bands, the cell key and its ramps, and the row color key.
 */
function variantParity(
  fixture: VariantFixture,
): ParityAdapter<
  Record<string, unknown>,
  LinearVariantDisplayModel,
  VariantTables,
  VariantDecision
> {
  return {
    decisionNames: VARIANT_DECISIONS,
    buildModel: async display => {
      const { display: model, dispose } =
        await standUpDisplay<LinearVariantDisplayModel>({
          plugins: [new VariantsPlugin()],
          track: { type: 'VariantTrack', adapter: fixture.adapterConfig },
          displayType: 'LinearVariantDisplay',
          isDisplay: (d): d is LinearVariantDisplayModel =>
            hasDisplayType(d, 'LinearVariantDisplay'),
          displayConfig: display,
          regions: fixture.regions,
          contigLengths: fixture.contigLengths,
          bpPerPx:
            fixture.regions.reduce((sum, r) => sum + r.end - r.start, 0) / 1000,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.variants({
        adapterConfig: fixture.adapterConfig,
        regions: fixture.regions,
        display,
      }),
    modelDecisions: m => {
      const cellKey = colorKeyTables(
        m.colorScales.filter(scale => scale.id !== ROW_KEY),
      )
      const rowKey = m.colorScales.filter(scale => scale.id === ROW_KEY)
      const { legend } = colorKeyTables(rowKey)
      const drawn = m.drawsGenotypeRows ? m.sources : []
      return {
        rows: drawn.map(s => ({
          name: s.name,
          label: s.label ?? s.name,
          sample: s.sampleName,
          haplotype: s.HP === undefined ? 0 : s.HP + 1,
        })),
        rowColors: drawn.map(s => m.resolvedRowColors.get(s.name) ?? ''),
        bands: m.rowBands.map(b => ({ key: b.key, label: b.label })),
        legend: { ...cellKey.legend, title: cellKey.legendTitle },
        ramps: cellKey.ramps,
        rowLegend: {
          label: legend.label,
          color: legend.color,
          title: rowKey[0]?.title ?? '',
        },
        cellColors: displayCellColors(m, fixture.regions),
        recordColors: displayRecordColors(m, fixture.regions),
      }
    },
    exportDecisions: t => ({
      rows: t.rows.name.map((name, i) => ({
        name,
        label: t.rows.label[i],
        sample: t.rows.sample[i],
        haplotype: t.rows.haplotype[i],
      })),
      rowColors: t.rows.color,
      bands: t.bands.key.map((key, i) => ({ key, label: t.bands.label[i] })),
      legend: { ...t.legend, title: t.legendTitle },
      ramps: t.ramps,
      rowLegend: { ...t.rowLegend, title: t.rowLegendTitle },
      recordColors: t.variants.color.map(
        (color, i) => `${t.variants.id[i]} ${color}`,
      ),
      cellColors: t.cells.color.map(
        (color, i) =>
          `${t.variants.id[t.cells.variant[i]!]} ${t.cells.row[i]} ${color}`,
      ),
    }),
  }
}

const CONTIG_LENGTH = 90_000_000

const snvs = variantParity({
  adapterConfig: DOG_VCF.adapterConfig,
  regions: [DOG_VCF.region],
  contigLengths: { chr30: CONTIG_LENGTH },
})

describe('39 dogs genotyped at SNVs, a few phased', () => {
  parityCases(snvs, [
    { name: 'defaults', config: {} },
    {
      name: 'rows.sort and rows.labels',
      config: {
        rows: {
          sort: ['GHND000003', 'GHND000001'],
          labels: { GHND000003: 'Proband' },
        },
      },
    },
    {
      name: 'rows.kept',
      config: { rows: { kept: ['GHND000002', 'GHND000005'] } },
    },
    { name: 'haplotype rows', config: { rows: 'haplotype' } },
    {
      name: 'haplotype rows, a sample in the order',
      config: { rows: { field: 'haplotype', sort: ['GHND000004'] } },
    },
    {
      name: 'haplotype rows, a sample label',
      config: {
        rows: {
          field: 'haplotype',
          labels: { GHND000001: 'Mother', 'GHND000002 HP2': 'paternal' },
        },
      },
    },
    {
      name: 'rows.tree',
      config: {
        rows: { tree: '((GHND000004:1,GHND000002:1):1,GHND000001:2);' },
      },
    },
    {
      name: 'site filter',
      config: { filter: [{ field: 'minorAlleleFrequency', gte: 0.3 }] },
    },
    {
      name: 'encoding.color legend title',
      config: { encoding: { color: { legend: { title: 'Calls' } } } },
    },
    {
      name: 'genotypes.reference shown',
      config: { genotypes: { reference: { show: true } } },
    },
    {
      name: 'rows.colors pinned',
      config: { rows: { colors: { GHND000001: '#123456' } } },
    },
    {
      name: 'genotypes hidden',
      config: { genotypes: { show: false } },
    },
    {
      name: 'genotypes hidden, a site filter testing nothing',
      config: {
        genotypes: { show: false },
        filter: [{ field: 'minorAlleleFrequency', gte: 0.3 }],
      },
    },
    {
      name: 'encoding.color a callback through an identity scale',
      config: {
        encoding: {
          color: {
            value:
              "jexl:get(feature,'start') > 38262000 ? '#ff0000' : '#0000ff'",
            scale: {
              type: 'identity',
              domain: ['#ff0000', '#0000ff'],
              names: ['late', 'early'],
            },
          },
        },
      },
    },
    {
      name: 'encoding.color by a field',
      config: { encoding: { color: { field: 'type' } } },
    },
    {
      name: 'haplotype rows, encoding.color by a field',
      config: { rows: 'haplotype', encoding: { color: { field: 'type' } } },
    },
    {
      name: 'encoding.color a constant, shaded by dosage',
      config: { encoding: { color: { value: '#cc3300' } } },
    },
    {
      name: 'encoding.color by INFO.AF through a threshold',
      config: {
        encoding: {
          color: {
            field: 'INFO.AF',
            scale: {
              type: 'threshold',
              domain: ['0.5'],
              range: ['#1f77b4', '#d62728'],
            },
          },
        },
      },
    },
    {
      name: 'rows.kept, encoding.color by INFO.AF in fine cuts',
      config: {
        rows: { kept: ['GHND000002'] },
        encoding: {
          color: {
            field: 'INFO.AF',
            scale: {
              type: 'threshold',
              domain: [
                '0.1',
                '0.2',
                '0.3',
                '0.4',
                '0.5',
                '0.6',
                '0.7',
                '0.8',
                '0.9',
              ],
            },
          },
        },
      },
    },
    {
      name: 'encoding.color by INFO.AF as a ramp',
      config: {
        encoding: { color: { field: 'INFO.AF', scale: { type: 'linear' } } },
      },
    },
    {
      name: 'encoding.color by phase set',
      config: { encoding: { color: { field: 'phaseSet' } } },
    },
    {
      name: 'haplotype rows, encoding.color by phase set',
      config: { rows: 'haplotype', encoding: { color: { field: 'phaseSet' } } },
    },
    {
      name: 'haplotype rows, encoding.color a constant',
      config: { rows: 'haplotype', encoding: { color: { value: '#cc3300' } } },
    },
  ])
})

const svs = variantParity({
  adapterConfig: DOG_SV.adapterConfig,
  regions: [DOG_SV.region],
  contigLengths: { chr6: CONTIG_LENGTH },
})

describe('dog SVs with a samples file of groups and breeds', () => {
  parityCases(svs, [
    {
      name: 'defaults',
      config: {},
    },
    {
      name: 'encoding.color by a field',
      config: { encoding: { color: { field: 'type' } } },
    },
    {
      name: 'rows.color by group',
      config: { rows: { color: { field: 'group' } } },
    },
    {
      name: 'rows.color by group under a pinned color and label',
      config: {
        rows: {
          color: { field: 'group' },
          colors: { LABR000001: '#123456' },
          labels: { LABR000001: 'Pinned dog' },
        },
      },
    },
    {
      name: 'rows.filter',
      config: { rows: { filter: [{ field: 'group', equal: 'Gray wolf' }] } },
    },
    {
      name: 'rows.filter and rows.kept',
      config: {
        rows: {
          filter: [{ field: 'group', equal: 'Village dog' }],
          kept: ['VILLAK000002', 'LABR000001'],
        },
      },
    },
    {
      name: 'facet',
      config: { facet: { field: 'group', sort: ['Gray wolf'] } },
    },
    {
      name: 'facet and rows.color by group',
      config: { facet: 'group', rows: { color: { field: 'group' } } },
    },
    {
      name: 'rows.color by breed',
      config: { rows: { color: { field: 'breed' } } },
    },
  ])
})

const SNV_LOCI = {
  adapterConfig: DOG_VCF.adapterConfig,
  regions: [
    { refName: 'chr30', start: 38_258_000, end: 38_261_000 },
    { refName: 'chr30', start: 38_262_000, end: 38_265_000 },
  ],
}

const BREAKEND_CONTIGS = {
  adapterConfig: BREAKENDS.adapterConfig,
  regions: [
    { refName: 'ctgA', start: 20_000, end: 25_000 },
    { refName: 'ctgB', start: 0, end: 5000 },
  ],
}

describe('two loci of the dog SNVs on chr30, end to end', () => {
  parityCases(
    variantParity({ ...SNV_LOCI, contigLengths: { chr30: CONTIG_LENGTH } }),
    [
      { name: 'defaults', config: {} },
      { name: 'haplotype rows', config: { rows: 'haplotype' } },
      {
        name: 'site filter',
        config: { filter: [{ field: 'minorAlleleFrequency', gte: 0.3 }] },
      },
      {
        name: 'encoding.color by INFO.AF as a ramp',
        config: {
          encoding: { color: { field: 'INFO.AF', scale: { type: 'linear' } } },
        },
      },
      {
        name: 'rows.tree',
        config: {
          rows: { tree: '((GHND000004:1,GHND000002:1):1,GHND000001:2);' },
        },
      },
    ],
  )
})

describe('a kilobase of the dog SNVs whose margin holds a type it lacks', () => {
  parityCases(
    variantParity({
      adapterConfig: DOG_VCF.adapterConfig,
      regions: [{ refName: 'chr30', start: 38_259_000, end: 38_260_000 }],
      contigLengths: { chr30: CONTIG_LENGTH },
    }),
    [
      {
        name: 'encoding.color by a field',
        config: { encoding: { color: { field: 'type' } } },
      },
    ],
  )
})

describe("breakends with no samples, nothing stating their contigs' lengths", () => {
  parityCases(
    variantParity({
      adapterConfig: BREAKENDS.adapterConfig,
      regions: [BREAKENDS.region],
      contigLengths: VOLVOX_CONTIGS,
    }),
    [
      { name: 'defaults', config: {} },
      {
        name: 'encoding.color by a field',
        config: { encoding: { color: { field: 'type' } } },
      },
    ],
  )
})

describe('breakends over loci on two contigs, end to end', () => {
  parityCases(
    variantParity({ ...BREAKEND_CONTIGS, contigLengths: VOLVOX_CONTIGS }),
    [
      { name: 'defaults', config: {} },
      {
        name: 'encoding.color by a field',
        config: { encoding: { color: { field: 'type' } } },
      },
    ],
  )
})

test('the several-region cases decide over records in each region', async () => {
  for (const args of [SNV_LOCI, BREAKEND_CONTIGS]) {
    const t = await engine.variants(args)
    expect(new Set(t.variants.region).size).toBe(args.regions.length)
  }
}, 60_000)
