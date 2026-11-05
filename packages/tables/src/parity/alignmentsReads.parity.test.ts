import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import AlignmentsPlugin, {
  isLinearAlignmentsDisplay,
} from '@jbrowse/plugin-alignments'

import { readColorFromCategoryIndex } from '../../../../plugins/alignments/src/LinearAlignmentsDisplay/colorUtils.ts'
import { createTablesEngine } from '../index.ts'
import {
  BAM,
  METHYLATED,
  PAIRED_INVERSION,
  READ_GROUPS,
  SV_READS,
} from '../volvox.fixture.ts'
import { VOLVOX_CONTIGS, standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { AlignmentTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'

interface ReadsFixture {
  adapterConfig: Record<string, unknown>
  regions: TablesRegion[]
  contigLengths: Record<string, number>
}

const READ_DECISIONS = ['legend', 'legendTitle', 'ramps', 'readColors'] as const

type ReadDecision = (typeof READ_DECISIONS)[number]

const engine = createTablesEngine()

/** The display keys only while `legend.show`, which the tables ignore. */
const keyed = (display: Record<string, unknown>) => ({
  legend: { show: true },
  ...display,
})

/**
 * The alignments display's read colors beside `engine.alignments` over one
 * fixture, read with no reference on either side: the read rows of its key
 * apart from the arcs', as the tables keep them, the key's title, its color
 * bars, and each read's painted color by its id.
 */
function readsParity(
  fixture: ReadsFixture,
): ParityAdapter<
  Record<string, unknown>,
  LinearAlignmentsDisplayModel,
  AlignmentTables,
  ReadDecision
> {
  return {
    decisionNames: READ_DECISIONS,
    buildModel: async display => {
      const { display: model, dispose } =
        await standUpDisplay<LinearAlignmentsDisplayModel>({
          plugins: [new AlignmentsPlugin()],
          track: { type: 'AlignmentsTrack', adapter: fixture.adapterConfig },
          displayType: 'LinearAlignmentsDisplay',
          isDisplay: isLinearAlignmentsDisplay,
          displayConfig: keyed(display),
          regions: fixture.regions,
          contigLengths: fixture.contigLengths,
          bpPerPx:
            fixture.regions.reduce((sum, r) => sum + r.end - r.start, 0) / 1000,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.alignments({
        adapterConfig: fixture.adapterConfig,
        regions: fixture.regions,
        display: keyed(display),
      }),
    modelDecisions: m => {
      const key = colorKeyTables(
        m.colorScales.filter(s => s.kind === 'ramp' || s.id === 'reads'),
      )
      const palette = m.themed.colors
      return {
        legend: { label: key.legend.label, color: key.legend.color },
        legendTitle: key.legendTitle,
        ramps: key.ramps,
        readColors: Object.fromEntries(
          [...m.laidOutByGroupColored.values()].flatMap(byRegion =>
            [...byRegion.values()].flatMap(data =>
              Array.from(data.readColorCategories, (category, i) =>
                fixture.regions.some(
                  w =>
                    data.readPositions[i * 2]! < w.end &&
                    data.readPositions[i * 2 + 1]! > w.start,
                )
                  ? [
                      [
                        `${data.readKeys[i]}`,
                        cssColorToHex(
                          readColorFromCategoryIndex(
                            category,
                            i,
                            data,
                            palette,
                          ),
                        ),
                      ],
                    ]
                  : [],
              ).flat(),
            ),
          ),
        ),
      }
    },
    exportDecisions: t => ({
      legend: t.legend,
      legendTitle: t.legendTitle,
      ramps: t.ramps,
      readColors: Object.fromEntries(
        t.reads.id.map((id, i) => [id, t.reads.color[i]]),
      ),
    }),
  }
}

const volvoxReads = readsParity({
  adapterConfig: BAM.adapterConfig,
  regions: [BAM.region],
  contigLengths: VOLVOX_CONTIGS,
})

test('both sides decide over every read and a keyed strand', async () => {
  const config = { encoding: { color: 'strand' } }
  const { model, dispose } = await volvoxReads.buildModel(config)
  try {
    const view = volvoxReads.modelDecisions(model)
    const exported = volvoxReads.exportDecisions(
      await volvoxReads.buildExport(config),
    )
    for (const side of [view, exported]) {
      expect(Object.keys(side.readColors ?? {}).length).toBeGreaterThan(900)
      expect(side.legend).toMatchObject({
        label: ['Forward strand', 'Reverse strand'],
      })
    }
  } finally {
    dispose()
  }
}, 60_000)

describe('volvox reads', () => {
  parityCases(volvoxReads, [
    { name: 'defaults', config: {} },
    { name: 'strand', config: { encoding: { color: 'strand' } } },
    {
      name: 'strand, a written range and legend title',
      config: {
        encoding: {
          color: {
            field: 'strand',
            scale: { range: ['#ff0000', '#0000ff'] },
            legend: { title: 'Mine' },
          },
        },
      },
    },
    {
      name: 'strand, descending',
      config: {
        encoding: { color: { field: 'strand', legend: { descending: true } } },
      },
    },
    {
      name: 'a written read color',
      config: { encoding: { color: { value: '#336699' } } },
    },
    { name: 'mapq bins', config: { encoding: { color: 'mapq' } } },
    {
      name: 'mapq bins, ascending',
      config: {
        encoding: { color: { field: 'mapq', legend: { descending: false } } },
      },
    },
    {
      name: 'mapq ramp under a legend title',
      config: {
        encoding: {
          color: {
            field: 'mapq',
            scale: { type: 'linear', domainMin: 0, domainMax: 30 },
            legend: { title: 'MQ' },
          },
        },
      },
    },
    {
      name: 'base quality',
      config: {
        pileup: {
          bases: { show: true, encoding: { color: { field: 'baseQuality' } } },
        },
      },
    },
  ])
})

describe('volvox reads in two read groups', () => {
  parityCases(
    readsParity({
      adapterConfig: READ_GROUPS.adapterConfig,
      regions: [BAM.region],
      contigLengths: VOLVOX_CONTIGS,
    }),
    [
      { name: 'tag', config: { encoding: { color: { field: 'tags.RG' } } } },
      {
        name: 'a tag no read carries, a written invalid color',
        config: {
          encoding: {
            color: { field: 'tags.XX', scale: { invalid: '#cc6600' } },
          },
        },
      },
      {
        name: 'tag, descending',
        config: {
          encoding: {
            color: { field: 'tags.RG', legend: { descending: true } },
          },
        },
      },
    ],
  )
})

describe('volvox pairs across an inversion', () => {
  parityCases(
    readsParity({
      adapterConfig: PAIRED_INVERSION.adapterConfig,
      regions: [PAIRED_INVERSION.region],
      contigLengths: VOLVOX_CONTIGS,
    }),
    [
      {
        name: 'insert size and orientation',
        config: { encoding: { color: 'insertSizeAndOrientation' } },
      },
      {
        name: 'insert size and orientation, a pinned band',
        config: {
          normalInsertSize: { min: 1, max: 2 },
          encoding: { color: 'insertSizeAndOrientation' },
        },
      },
      {
        name: 'insert size and orientation, written colors',
        config: {
          encoding: {
            color: {
              field: 'insertSizeAndOrientation',
              scale: { domain: ['RR', 'LL'], range: ['#d95f02', '#1b9e77'] },
            },
          },
        },
      },
      {
        name: 'a linear tag',
        config: {
          encoding: { color: { field: 'tags.NM', scale: { type: 'linear' } } },
        },
      },
    ],
  )
})

describe('ONT reads with 5mC calls', () => {
  parityCases(
    readsParity({
      adapterConfig: METHYLATED.adapterConfig,
      regions: [METHYLATED.region],
      contigLengths: { [METHYLATED.region.refName]: 29_565 },
    }),
    [
      {
        name: 'modifications',
        config: {
          pileup: {
            bases: { show: true, encoding: { color: 'modifications' } },
          },
        },
      },
    ],
  )
})

const TWO_LOCI = [
  { refName: 'ctgA', start: 1000, end: 6000 },
  { refName: 'ctgA', start: 20_000, end: 25_000 },
]

const TWO_CONTIGS = [
  { refName: 'ctgA', start: 1000, end: 4000 },
  { refName: 'ctgB', start: 1000, end: 4000 },
]

describe('two loci of volvox reads on ctgA, end to end', () => {
  parityCases(
    readsParity({
      adapterConfig: BAM.adapterConfig,
      regions: TWO_LOCI,
      contigLengths: VOLVOX_CONTIGS,
    }),
    [
      { name: 'defaults', config: {} },
      { name: 'strand', config: { encoding: { color: 'strand' } } },
      { name: 'mapq bins', config: { encoding: { color: 'mapq' } } },
    ],
  )
})

describe('simulated pairs over loci on two contigs, end to end', () => {
  parityCases(
    readsParity({
      adapterConfig: SV_READS.adapterConfig,
      regions: TWO_CONTIGS,
      contigLengths: VOLVOX_CONTIGS,
    }),
    [
      { name: 'strand', config: { encoding: { color: 'strand' } } },
      {
        name: 'insert size and orientation',
        config: { encoding: { color: 'insertSizeAndOrientation' } },
      },
    ],
  )
})

test('the several-region cases decide over reads in each region', async () => {
  for (const args of [
    { adapterConfig: BAM.adapterConfig, regions: TWO_LOCI },
    { adapterConfig: SV_READS.adapterConfig, regions: TWO_CONTIGS },
  ]) {
    const t = await engine.alignments({ ...args, display: {} })
    expect(new Set(t.reads.region).size).toBe(args.regions.length)
  }
}, 60_000)
