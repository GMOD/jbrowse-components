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
} from '../volvox.fixture.ts'
import { standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { AlignmentTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'

interface ReadsFixture {
  adapterConfig: Record<string, unknown>
  region: TablesRegion
  contigLength: number
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
          region: fixture.region,
          contigLength: fixture.contigLength,
          bpPerPx: (fixture.region.end - fixture.region.start) / 1000,
          settled: m => m.rpcDataMap.size > 0,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.alignments({
        adapterConfig: fixture.adapterConfig,
        region: fixture.region,
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
              Array.from(data.readColorCategories, (category, i) => [
                `${data.readKeys[i]}`,
                cssColorToHex(
                  readColorFromCategoryIndex(category, i, data, palette),
                ),
              ]),
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

const VOLVOX_CONTIG = 50_001

const volvoxReads = readsParity({ ...BAM, contigLength: VOLVOX_CONTIG })

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
      ...READ_GROUPS,
      region: BAM.region,
      contigLength: VOLVOX_CONTIG,
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
    readsParity({ ...PAIRED_INVERSION, contigLength: VOLVOX_CONTIG }),
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
  parityCases(readsParity({ ...METHYLATED, contigLength: 29_565 }), [
    {
      name: 'modifications',
      config: {
        pileup: {
          bases: { show: true, encoding: { color: 'modifications' } },
        },
      },
    },
  ])
})
