import { createTablesEngine } from '../index.ts'
import { CONTIGS, INVERSIONS, INVERSIONS_WIDE } from './comparative.fixture.ts'
import { TRACK_NAME, standUpDotplot } from './comparative/testEnv.ts'
import {
  COMPARATIVE_DECISIONS,
  drawnColors,
  exportKey,
  exportedColors,
  hostAxis,
  viewKey,
} from './comparative/testUtils.ts'
import { parityCases } from './testUtils.ts'

import type { DotplotTables, DotplotTablesArgs } from '../index.ts'
import type { ComparativeFixture } from './comparative.fixture.ts'
import type { ParityAdapter } from './testUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

type DotplotView = NonNullable<DotplotTablesArgs['view']>
type DotplotModel = Awaited<ReturnType<typeof standUpDotplot>>
type DotplotDecision = (typeof COMPARATIVE_DECISIONS)[number]

const engine = createTablesEngine()

/**
 * The dotplot beside `engine.dotplot` over one fixture, the query on the
 * horizontal axis: each alignment's drawn segments in their colors and
 * alpha, the alignments the filter admits, the key and the opacity level.
 */
function dotplotParity(
  fixture: ComparativeFixture,
): ParityAdapter<DotplotView, DotplotModel, DotplotTables, DotplotDecision> {
  return {
    decisionNames: COMPARATIVE_DECISIONS,
    buildModel: async settings => {
      const model = await standUpDotplot({
        adapterConfig: fixture.adapterConfig,
        axes: [fixture.query, fixture.target],
        settings,
      })
      return { model, dispose: model.dispose }
    },
    buildExport: view =>
      engine.dotplot({
        adapterConfig: fixture.adapterConfig,
        trackName: TRACK_NAME,
        x: hostAxis(fixture.query),
        y: hostAxis(fixture.target),
        view,
      }),
    modelDecisions: ({ view, display }) => {
      const drawn = drawnColors(display.geometry, view.opacityLevel, String)
      return {
        colors: drawn,
        admitted: Object.keys(drawn).sort(),
        key: viewKey(view.colorScales),
        level: view.opacityLevel,
      }
    },
    exportDecisions: t => ({
      colors: exportedColors(t.segments, String),
      admitted: t.alignments.alpha
        .flatMap((alpha, i) => (alpha > 0 ? [String(i)] : []))
        .sort(),
      key: exportKey(t),
      level: t.alpha,
    }),
  }
}

describe('a PAF of seven blocks, two reverse, with text and numeric columns', () => {
  parityCases(dotplotParity(INVERSIONS), [
    {
      name: 'defaults',
      config: {},
    },
    { name: 'strand', config: { encoding: { color: { field: 'strand' } } } },
    {
      name: 'identity',
      config: { encoding: { color: { field: 'identity' } } },
    },
    {
      name: 'identity, threshold',
      config: {
        encoding: {
          color: {
            field: 'identity',
            scale: { type: 'threshold', domain: [0.92, 0.94] },
          },
        },
      },
    },
    { name: 'mapq', config: { encoding: { color: { field: 'mapq' } } } },
    { name: 'query', config: { encoding: { color: { field: 'query' } } } },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
    {
      name: 'track',
      config: { encoding: { color: { field: 'track' } } },
    },
    {
      name: 'a constant',
      config: { encoding: { color: { value: '#008000' } } },
    },
    {
      name: 'a text column, partly labelled',
      config: { encoding: { color: { field: 'gr' } } },
    },
    {
      name: 'a text column, its no-value rows hidden',
      config: {
        encoding: { color: { field: 'gr' } },
        filter: [{ field: 'gr', valid: true }],
      },
    },
    {
      name: 'a text column, scale.invalid',
      config: {
        encoding: { color: { field: 'gr', scale: { invalid: '#0000ff' } } },
      },
    },
    {
      name: 'a numeric column, partly present',
      config: { encoding: { color: { field: 'zd' } } },
    },
    {
      name: 'a numeric column, its no-value rows hidden',
      config: {
        encoding: { color: { field: 'zd' } },
        filter: [{ field: 'zd', valid: true }],
      },
    },
    {
      name: 'a numeric column, scale.invalid',
      config: {
        encoding: { color: { field: 'zd', scale: { invalid: '#0000ff' } } },
      },
    },
    {
      name: 'opacity, colored by strand',
      config: {
        encoding: { color: { field: 'strand' }, opacity: { value: 0.4 } },
      },
    },
    {
      name: 'opacity by identity',
      config: { encoding: { opacity: { field: 'identity' } } },
    },
    {
      name: 'filter by length',
      config: { filter: [{ field: 'length', gte: 2000 }] },
    },
    {
      name: 'filter by a text column',
      config: { filter: [{ field: 'gr', oneOf: ['a'] }] },
    },
  ])
})

describe('both contigs at 4000 px, the CIGAR steps wide enough to draw', () => {
  parityCases(dotplotParity(INVERSIONS_WIDE), [
    { name: 'strand', config: { encoding: { color: { field: 'strand' } } } },
    {
      name: 'strand, indels hidden',
      config: {
        encoding: { color: { field: 'strand' } },
        indels: { show: false },
      },
    },
  ])
})

describe('two contigs aligned to each other, shown out of assembly order', () => {
  parityCases(dotplotParity(CONTIGS), [
    { name: 'query', config: { encoding: { color: { field: 'query' } } } },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
  ])
})
