import { getContrastText } from '@jbrowse/core/ui/palette'
import { cssColorToABGR, cssColorToHex } from '@jbrowse/core/util/colorBits'
import { bandGroundColor, unpack } from '@jbrowse/synteny-core'

import { ribbonThinFade } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { KIND_MARKER } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyKinds.ts'
import { recordedOffscreenStrips } from '../../../../plugins/linear-comparative-view/src/tables.ts'
import { createTablesEngine } from '../index.ts'
import {
  CONTIGS,
  INVERSIONS,
  INVERSIONS_ZOOMED,
  OFFSCREEN,
  OFFSCREEN_WINDOW,
} from './comparative.fixture.ts'
import { TRACK_NAME, standUpSynteny } from './comparative/testEnv.ts'
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

const SYNTENY_DECISIONS = [
  ...COMPARATIVE_DECISIONS,
  'offscreen',
  'strip',
] as const

type SyntenyDecision = (typeof SYNTENY_DECISIONS)[number]

const LEVEL_HEIGHT = 100

const engine = createTablesEngine()

const AXIS_OF_SIDE = { top: 'query', bottom: 'target' } as const

const px = (n: number) => Math.round(n * 1000) / 1000

/** A painted strip's marks and labels, where each lands and in what color. */
function stripMarks({
  marks,
  labels,
}: Pick<ReturnType<typeof recordedOffscreenStrips>, 'marks' | 'labels'>) {
  return {
    marks: marks.x.map(
      (x, i) =>
        `${marks.axis[i]} ${px(x)}+${px(marks.width[i]!)} ${px(marks.y[i]!)}+${px(marks.height[i]!)} ${marks.color[i]}`,
    ),
    labels: labels.label.map(
      (label, i) => `${labels.axis[i]} ${label} ${px(labels.x[i]!)}`,
    ),
  }
}

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
        trackName: TRACK_NAME,
        query: hostAxis(fixture.query),
        target: hostAxis(fixture.target),
        view: { height: LEVEL_HEIGHT, ...view },
      }),
    modelDecisions: ({ view, level, display }) => {
      const geometry = display.renderInstanceData
      const params = display.renderParams
      const corners = (i: number) => ({
        sx1: px(geometry?.bp1[i], geometry?.base0, 0),
        sx2: px(geometry?.bp2[i], geometry?.base0, 0),
        sx3: px(geometry?.bp3[i], geometry?.base1, 1),
        sx4: px(geometry?.bp4[i], geometry?.base1, 1),
      })
      const px = (bp = 0, base = 0, row: 0 | 1) =>
        params
          ? (bp + base) / params[`bpPerPx${row}`] - params[`offsetPx${row}`]
          : 0
      const drawn = drawnColors(
        geometry,
        view.opacityLevel,
        f => display.featureData?.featureIds[f] ?? '',
        i => {
          const xs = Object.values(corners(i))
          return Math.max(...xs) > 0 && Math.min(...xs) < view.width
        },
        i => {
          const kind = geometry?.kinds[i] ?? KIND_MARKER
          return params && kind !== KIND_MARKER
            ? ribbonThinFade(
                corners(i),
                params.height,
                params.drawCurves,
                kind,
                params.fadeThinAlignments,
              ).fade
            : 1
        },
      )
      const ink = cssColorToHex(getContrastText(bandGroundColor()))
      const strip = recordedOffscreenStrips(
        level.offscreenMateStrips,
        level.height,
      )
      return {
        strip: stripMarks(strip),
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
        strip: stripMarks(t.offscreenStrip),
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

describe('a PAF of seven blocks, two reverse, with text and numeric columns', () => {
  parityCases(syntenyParity(INVERSIONS), [
    {
      name: 'defaults',
      config: {},
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
    },
    {
      name: 'filter by length',
      config: { filter: [{ field: 'length', gte: 2000 }] },
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
    },
  ])
})

/**
 * The view's off-screen strips also mark each ribbon whose mate has scrolled
 * out of the facing row's window (`culledRibbonMates`), which the tables do
 * not yet list: they list only mates on a contig the facing row does not show.
 */
const CULLED_MATES = {
  offscreen: { owner: 'synteny tables: culled ribbon mates', exported: [] },
}

describe('3 kb of each row, the CIGAR indels wide enough to draw', () => {
  parityCases(syntenyParity(INVERSIONS_ZOOMED), [
    { name: 'defaults', config: {}, drifts: CULLED_MATES },
    {
      name: 'strand',
      config: { encoding: { color: { field: 'strand' } } },
      drifts: CULLED_MATES,
    },
    {
      name: 'strand, indels hidden',
      config: {
        encoding: { color: { field: 'strand' } },
        indels: { show: false },
      },
      drifts: CULLED_MATES,
    },
    {
      name: 'strand, indels left as gaps',
      config: {
        encoding: { color: { field: 'strand' } },
        indels: { encoding: { opacity: 0 } },
      },
      drifts: CULLED_MATES,
    },
    {
      name: 'identity',
      config: { encoding: { color: { field: 'identity' } } },
      drifts: CULLED_MATES,
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

describe('4 kb of the upper row inside its contig, each block mated to a contig the lower row does not show', () => {
  parityCases(syntenyParity(OFFSCREEN_WINDOW), [
    { name: 'defaults', config: {} },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
  ])
})

describe('each block mated to a contig the other row does not show', () => {
  parityCases(syntenyParity(OFFSCREEN), [
    {
      name: 'defaults',
      config: {},
    },
    { name: 'query', config: { encoding: { color: { field: 'query' } } } },
    { name: 'target', config: { encoding: { color: { field: 'target' } } } },
    {
      name: 'filter by length',
      config: { filter: [{ field: 'length', gte: 10000 }] },
    },
    {
      name: 'filter by query contig',
      config: { filter: [{ field: 'query', oneOf: ['ctgA'] }] },
    },
  ])
})
