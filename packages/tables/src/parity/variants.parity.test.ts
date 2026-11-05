import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import VariantsPlugin from '@jbrowse/plugin-variants'

import { createTablesEngine } from '../index.ts'
import { DOG_SV, DOG_VCF } from '../volvox.fixture.ts'
import { hasDisplayType, standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { VariantTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearVariantDisplayModel } from '@jbrowse/plugin-variants'

interface VariantFixture {
  adapterConfig: Record<string, unknown>
  region: TablesRegion
  contigLength: number
}

const VARIANT_DECISIONS = [
  'rows',
  'rowColors',
  'bands',
  'legend',
  'ramps',
  'rowLegend',
] as const

type VariantDecision = (typeof VARIANT_DECISIONS)[number]

const ROW_KEY = 'rows.color'

const NO_RECORDS_KEY =
  'unowned, variants tables key no records-band scale: SV type'
const HIDDEN_GENOTYPES =
  'unowned, variants tables ship rows and a genotype key genotypes.show hides'
const IDENTITY_KEY =
  'unowned, variants tables key no identity-scale names of a color callback'

const DOGS = [
  'GHND000001',
  'GHND000002',
  'GHND000003',
  'GHND000004',
  'GHND000005',
  'GHND000006',
  'BHSP000001',
  'BHSP000002',
  'BHSP000003',
  'BHSP000004',
  'BHSP000005',
  'BHSP000006',
  'SSHP000001',
  'SSHP000002',
  'SSHP000003',
  'SSHP000004',
  'BRTR000001',
  'BRTR000002',
  'BRTR000003',
  'BRTR000004',
  'BRTR000005',
  'KEES000002',
  'KEES000003',
  'KEES000004',
  'KEES000005',
  'KEES000006',
  'LABR000001',
  'LABR000002',
  'LABR000003',
  'LABR000004',
  'LABR000005',
  'BOXR000001',
  'BOXR000002',
  'BOXR000003',
  'BOXR000004',
  'CLUPGR000001',
  'CLUPGR000002',
  'CLUPGR000003',
  'CLUPGR000004',
]

const FILE_ORDER_ROWS = DOGS.map(name => ({
  name,
  label: name,
  sample: name,
  haplotype: 0,
}))

const GENOTYPE_KEY = {
  label: [
    'Homozygous reference',
    'Alt, half dosage (het)',
    'Alt, full dosage (hom)',
  ],
  color: ['#cccccc', '#539fc6', '#006084'],
  section: ['Genotypes', 'Genotypes', 'Genotypes'],
  title: 'Genotypes',
}

const engine = createTablesEngine()

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
          region: fixture.region,
          contigLength: fixture.contigLength,
          bpPerPx: (fixture.region.end - fixture.region.start) / 1000,
          settled: m => m.cellData !== undefined && m.sourcesBase !== undefined,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.variants({
        adapterConfig: fixture.adapterConfig,
        region: fixture.region,
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
    }),
  }
}

const CONTIG_LENGTH = 90_000_000

const snvs = variantParity({
  adapterConfig: DOG_VCF.adapterConfig,
  region: DOG_VCF.region,
  contigLength: CONTIG_LENGTH,
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
      drifts: {
        rows: { owner: HIDDEN_GENOTYPES, exported: FILE_ORDER_ROWS },
        rowColors: {
          owner: HIDDEN_GENOTYPES,
          exported: DOGS.map(() => ''),
        },
        legend: {
          owner: HIDDEN_GENOTYPES,
          exported: {
            label: [...GENOTYPE_KEY.label, 'No call'],
            color: [...GENOTYPE_KEY.color, '#bfaa40'],
            section: [...GENOTYPE_KEY.section, 'Genotypes'],
            title: 'Genotypes',
          },
        },
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
      drifts: {
        legend: {
          owner: IDENTITY_KEY,
          exported: { label: [], color: [], section: [], title: '' },
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
  ])
})

const svs = variantParity({
  adapterConfig: DOG_SV.adapterConfig,
  region: DOG_SV.region,
  contigLength: CONTIG_LENGTH,
})

describe('dog SVs with a samples file of groups and breeds', () => {
  parityCases(svs, [
    {
      name: 'defaults',
      config: {},
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'rows.color by group',
      config: { rows: { color: { field: 'group' } } },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
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
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'rows.filter',
      config: { rows: { filter: [{ field: 'group', equal: 'Gray wolf' }] } },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'rows.filter and rows.kept',
      config: {
        rows: {
          filter: [{ field: 'group', equal: 'Village dog' }],
          kept: ['VILLAK000002', 'LABR000001'],
        },
      },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'facet',
      config: { facet: { field: 'group', sort: ['Gray wolf'] } },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'facet and rows.color by group',
      config: { facet: 'group', rows: { color: { field: 'group' } } },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
    {
      name: 'rows.color by breed',
      config: { rows: { color: { field: 'breed' } } },
      drifts: { legend: { owner: NO_RECORDS_KEY, exported: GENOTYPE_KEY } },
    },
  ])
})
