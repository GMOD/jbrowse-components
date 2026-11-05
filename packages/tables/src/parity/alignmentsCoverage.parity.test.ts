import AlignmentsPlugin, {
  isLinearAlignmentsDisplay,
} from '@jbrowse/plugin-alignments'

import { createTablesEngine } from '../index.ts'
import { BAM } from '../volvox.fixture.ts'
import { standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { AlignmentTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments/LinearAlignmentsDisplay/stateModel'

const COVERAGE_DECISIONS = ['sections', 'domain', 'scaleType', 'ticks'] as const

type CoverageDecision = (typeof COVERAGE_DECISIONS)[number]

const engine = createTablesEngine()

/**
 * The alignments display's coverage band beside `engine.alignments` over
 * `BAM`'s region, read with no reference on either side: the sections the
 * facet splits the reads into, and the depth axis they share, its domain,
 * scale type and the ticks it labels at the band's height.
 */
const coverage: ParityAdapter<
  Record<string, unknown>,
  LinearAlignmentsDisplayModel,
  AlignmentTables,
  CoverageDecision
> = {
  decisionNames: COVERAGE_DECISIONS,
  buildModel: async display => {
    const { display: model, dispose } =
      await standUpDisplay<LinearAlignmentsDisplayModel>({
        plugins: [new AlignmentsPlugin()],
        track: { type: 'AlignmentsTrack', adapter: BAM.adapterConfig },
        displayType: 'LinearAlignmentsDisplay',
        isDisplay: isLinearAlignmentsDisplay,
        displayConfig: display,
        region: BAM.region,
        contigLength: 50_001,
        bpPerPx: 5,
        settled: m => m.coverageTicks !== undefined,
      })
    return { model, dispose }
  },
  buildExport: display =>
    engine.alignments({
      adapterConfig: BAM.adapterConfig,
      region: BAM.region,
      display,
    }),
  modelDecisions: m => ({
    sections: m.renderSections.map(s => s.groupKey),
    domain: m.coverageDepthDomain,
    scaleType: m.scaleType,
    ticks: m.coverageTicks?.items.map(tick => tick.value),
  }),
  exportDecisions: t => ({
    sections: t.sections.key,
    domain: t.coverageScale.domain,
    scaleType: t.coverageScale.type,
    ticks: t.coverageScale.ticks,
  }),
}

describe('the coverage band over volvox reads', () => {
  parityCases(coverage, [
    { name: 'defaults', config: {} },
    {
      name: 'a short track squeezes the band',
      config: { coverage: { height: 100 }, height: 80 },
    },
    {
      name: 'a tall track',
      config: { coverage: { height: 100 }, height: 400 },
    },
    {
      name: 'no pileup',
      config: {
        coverage: { height: 100 },
        height: 80,
        pileup: { show: false },
      },
    },
    {
      name: 'encoding.y domainMax',
      config: { coverage: { encoding: { y: { scale: { domainMax: 15 } } } } },
    },
    {
      name: 'encoding.y log',
      config: { coverage: { encoding: { y: { scale: { type: 'log' } } } } },
    },
    {
      name: 'encoding.y symlog',
      config: { coverage: { encoding: { y: { scale: { type: 'symlog' } } } } },
    },
    {
      name: 'encoding.y zero off',
      config: { coverage: { encoding: { y: { scale: { zero: false } } } } },
    },
    {
      name: 'encoding.y fence',
      config: {
        coverage: { encoding: { y: { scale: { fenceQuantile: 0.9 } } } },
      },
    },
    {
      name: 'encoding.y rules',
      config: { coverage: { encoding: { y: { rules: [{ value: 60 }] } } } },
    },
    {
      name: 'encoding.y a fixed domain',
      config: {
        coverage: {
          encoding: { y: { scale: { domainMin: 5, domainMax: 20 } } },
        },
      },
    },
    {
      name: 'encoding.y domainMin alone, zero off',
      config: {
        coverage: {
          encoding: { y: { scale: { domainMin: 3, zero: false } } },
        },
      },
    },
    {
      name: 'encoding.y log with a pinned max',
      config: {
        coverage: {
          encoding: { y: { scale: { type: 'log', domainMax: 100 } } },
        },
      },
    },
    {
      name: 'encoding.y a clip fence',
      config: {
        coverage: { encoding: { y: { scale: { fenceQuantile: 0.99 } } } },
      },
    },
    {
      name: 'encoding.y a group, alone in its view',
      config: { coverage: { encoding: { y: { scale: { group: 'shared' } } } } },
    },
    { name: 'v4 autoscale local', config: { autoscale: 'local' } },
    { name: 'v4 autoscale global', config: { autoscale: 'global' } },
    { name: 'v4 autoscale globalsd', config: { autoscale: 'globalsd' } },
    {
      name: 'v4 autoscale localpercentile',
      config: { autoscale: 'localpercentile' },
    },
    { name: 'v4 minScore and maxScore', config: { minScore: 5, maxScore: 20 } },
    { name: 'v4 scaleType log', config: { scaleType: 'log' } },
    { name: 'facet by strand', config: { facet: 'strand' } },
    {
      name: 'facet by strand, log',
      config: {
        facet: 'strand',
        coverage: { encoding: { y: { scale: { type: 'log' } } } },
      },
    },
    {
      name: 'facet by strand, one hidden',
      config: { facet: { field: 'strand', hidden: ['-1'] } },
    },
    {
      name: 'facet by strand, sorted',
      config: { facet: { field: 'strand', sort: ['-1'] } },
    },
  ])
})
