import { getContrastText } from '@jbrowse/core/ui/palette'
import { cssColorToABGR, cssColorToHex } from '@jbrowse/core/util/colorBits'
import { bandGroundColor, unpack } from '@jbrowse/synteny-core'

import { createTablesEngine } from '../index.ts'
import {
  CONTIGS,
  INVERSIONS,
  INVERSIONS_ZOOMED,
  OFFSCREEN,
} from './comparative.fixture.ts'
import { standUpSynteny } from './comparative/testEnv.ts'
import {
  COMPARATIVE_DECISIONS,
  drawnColors,
  exportKey,
  exportedColors,
  hostAxis,
  viewKey,
} from './comparative/testUtils.ts'
import { parityCases } from './testUtils.ts'

import type { SyntenyTables, SyntenyTablesArgs } from '../index.ts'
import type { ComparativeFixture } from './comparative.fixture.ts'
import type { ParityAdapter } from './testUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

type SyntenyView = NonNullable<SyntenyTablesArgs['view']>
type SyntenyModel = Awaited<ReturnType<typeof standUpSynteny>>

const SYNTENY_DECISIONS = [...COMPARATIVE_DECISIONS, 'offscreen'] as const

type SyntenyDecision = (typeof SYNTENY_DECISIONS)[number]

const LEVEL_HEIGHT = 100

const engine = createTablesEngine()

const AXIS_OF_SIDE = { top: 'query', bottom: 'target' } as const

/**
 * The linear synteny view's one level beside `engine.synteny` over one
 * fixture: each alignment's drawn ribbons in their colors and alpha, the
 * alignments the filter admits, the key, the opacity level, and the
 * contigs the off-screen strips name with their counts and mark color.
 */
function syntenyParity(
  fixture: ComparativeFixture,
): ParityAdapter<SyntenyView, SyntenyModel, SyntenyTables, SyntenyDecision> {
  return {
    decisionNames: SYNTENY_DECISIONS,
    buildModel: async ({ height = LEVEL_HEIGHT, ...settings }) => {
      const model = await standUpSynteny({
        adapterConfig: fixture.adapterConfig,
        axes: [fixture.query, fixture.target],
        settings,
        height,
      })
      return { model, dispose: model.dispose }
    },
    buildExport: view =>
      engine.synteny({
        adapterConfig: fixture.adapterConfig,
        query: hostAxis(fixture.query),
        target: hostAxis(fixture.target),
        view: { height: LEVEL_HEIGHT, ...view },
      }),
    modelDecisions: ({ view, level, display }) => {
      const drawn = drawnColors(
        display.renderInstanceData,
        view.opacityLevel,
        f => display.featureData?.featureIds[f] ?? '',
      )
      const ink = cssColorToHex(getContrastText(bandGroundColor()))
      return {
        colors: drawn,
        admitted: Object.keys(drawn).sort(),
        key: viewKey(view.colorScales),
        level: view.opacityLevel,
        offscreen: level.offscreenMateStrips.flatMap(strip =>
          strip.datasets.flatMap(data =>
            data.mateRefNameDict.flatMap((mateChrom, id) => {
              const count = data.counts[id] ?? 0
              return count > 0
                ? [
                    {
                      axis: AXIS_OF_SIDE[strip.side],
                      mateChrom,
                      count,
                      alignedBp: data.alignedBp[id],
                      color: strip.markColorFor
                        ? unpack(cssColorToABGR(strip.markColorFor(mateChrom)))
                            .color
                        : ink,
                    },
                  ]
                : []
            }),
          ),
        ),
      }
    },
    exportDecisions: t => {
      const { alignments, ribbons, offscreenContigs: o } = t
      return {
        colors: exportedColors(ribbons, i => alignments.id[i] ?? ''),
        admitted: alignments.id
          .filter((_, i) => alignments.alpha[i]! > 0)
          .sort(),
        key: exportKey(t),
        level: t.alpha,
        offscreen: o.mateChrom.flatMap((mateChrom, i) =>
          o.count[i]! > 0
            ? [
                {
                  axis: o.axis[i],
                  mateChrom,
                  count: o.count[i],
                  alignedBp: o.alignedBp[i],
                  color: o.color[i],
                },
              ]
            : [],
        ),
      }
    },
  }
}

const DEFAULT_KEY =
  'unowned, synteny tables key the default color, which the view leaves unkeyed'
const MATCH = { label: 'match', color: '#ff8c8c' }
const INSERTION = { label: 'insertion', color: '#ffff8c' }
const DELETION = { label: 'deletion', color: '#8c8cff' }

const defaultKey = (...chips: { label: string; color: string }[]) => ({
  title: 'Default',
  chips,
  ramps: [],
})

const NO_KEY = { title: '', chips: [], ramps: [] }

const TRACK_KEY =
  'unowned, synteny tables key no track chip: the view keys the track by name'

describe('a PAF of seven blocks, two reverse, with text and numeric columns', () => {
  parityCases(syntenyParity(INVERSIONS), [
    {
      name: 'defaults',
      config: {},
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH, INSERTION),
        },
      },
    },
    { name: 'strand', config: { encoding: { color: { field: 'strand' } } } },
    {
      name: 'strand, a range',
      config: {
        encoding: {
          color: {
            field: 'strand',
            scale: { domain: ['-1', '1'], range: ['#ff0000', '#0000ff'] },
          },
        },
      },
    },
    {
      name: 'identity',
      config: { encoding: { color: { field: 'identity' } } },
    },
    {
      name: 'identity, a scheme and a pinned end',
      config: {
        encoding: {
          color: {
            field: 'identity',
            scale: { scheme: 'magma', domainMin: 0.9 },
          },
        },
      },
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
      name: 'reference',
      config: { encoding: { color: { field: 'reference' } } },
    },
    {
      name: 'track',
      config: { encoding: { color: { field: 'track' } } },
      drifts: { key: { owner: TRACK_KEY, exported: NO_KEY } },
    },
    {
      name: 'a constant',
      config: { encoding: { color: { value: '#008000' } } },
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH, INSERTION),
        },
      },
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
      name: 'a text column, domain, range, names and a title',
      config: {
        encoding: {
          color: {
            field: 'gr',
            scale: {
              domain: ['b', 'a'],
              range: ['#1b9e77', '#d95f02'],
              names: ['Bee', 'Ay'],
            },
            legend: { title: 'Group' },
          },
        },
      },
    },
    {
      name: 'a text column every alignment carries',
      config: { encoding: { color: { field: 'tp' } } },
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
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(
            { label: 'match', color: '#ff0000' },
            { label: 'insertion', color: '#ffff00' },
          ),
        },
      },
    },
    {
      name: 'filter by length',
      config: { filter: [{ field: 'length', gte: 2000 }] },
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH, INSERTION),
        },
      },
    },
    {
      name: 'filter by identity, colored by strand',
      config: {
        encoding: { color: { field: 'strand' } },
        filter: [{ field: 'identity', gte: 0.92 }],
      },
    },
    {
      name: 'filter by a text column',
      config: { filter: [{ field: 'gr', oneOf: ['a'] }] },
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH, INSERTION),
        },
      },
    },
  ])
})

describe('3 kb of each row, the CIGAR indels wide enough to draw', () => {
  parityCases(syntenyParity(INVERSIONS_ZOOMED), [
    {
      name: 'defaults',
      config: {},
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH, INSERTION, DELETION),
        },
      },
    },
    { name: 'strand', config: { encoding: { color: { field: 'strand' } } } },
    {
      name: 'strand, indels hidden',
      config: {
        encoding: { color: { field: 'strand' } },
        indels: { show: false },
      },
    },
    {
      name: 'strand, indels left as gaps',
      config: {
        encoding: { color: { field: 'strand' } },
        indels: { encoding: { opacity: 0 } },
      },
    },
    {
      name: 'identity',
      config: { encoding: { color: { field: 'identity' } } },
    },
  ])
})

describe('two contigs aligned to each other, shown out of assembly order', () => {
  parityCases(syntenyParity(CONTIGS), [
    { name: 'query', config: { encoding: { color: { field: 'query' } } } },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
    {
      name: 'filter by query contig',
      config: {
        encoding: { color: { field: 'target' } },
        filter: [{ field: 'query', oneOf: ['ctgA'] }],
      },
    },
  ])
})

describe('each block mated to a contig the other row does not show', () => {
  parityCases(syntenyParity(OFFSCREEN), [
    {
      name: 'defaults',
      config: {},
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH),
        },
      },
    },
    { name: 'query', config: { encoding: { color: { field: 'query' } } } },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
    {
      name: 'filter by length',
      config: { filter: [{ field: 'length', gte: 10000 }] },
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH),
        },
      },
    },
    {
      name: 'filter by query contig',
      config: { filter: [{ field: 'query', oneOf: ['ctgA'] }] },
      drifts: {
        key: {
          owner: DEFAULT_KEY,
          exported: defaultKey(MATCH),
        },
      },
    },
  ])
})
