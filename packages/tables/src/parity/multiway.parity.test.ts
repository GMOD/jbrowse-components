import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { unpack } from '@jbrowse/synteny-core'

import { ribbonThinFade } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { KIND_BASE_TILE } from '../../../../plugins/linear-comparative-view/src/LinearSyntenyRPC/syntenyKinds.ts'
import { MULTIWAY_FADE_THIN } from '../../../../plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/multiwayRenderTypes.ts'
import { createTablesEngine } from '../index.ts'
import {
  ALL_VS_ALL_LANES,
  ALL_VS_ALL_UNALIGNED,
  ALL_VS_ALL_ZOOMED,
  GENE_BLOCK_LANES,
  STAR_LANES,
  SYRI_LANES,
} from './comparative.fixture.ts'
import { standUpMultiway } from './comparative/testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { MultiWayTables, MultiWayTablesArgs } from '../index.ts'
import type { MultiwayFixture } from './comparative.fixture.ts'
import type { ParityAdapter } from './testUtils.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

type MultiwayCase = Pick<MultiWayTablesArgs, 'display' | 'pins' | 'hidden'>
type MultiwayModel = Awaited<ReturnType<typeof standUpMultiway>>

const MULTIWAY_DECISIONS = [
  'lanes',
  'segments',
  'blocks',
  'ribbons',
  'alignments',
  'columns',
  'key',
  'height',
  'tickInterval',
  'rowsVsAnchor',
] as const

type MultiwayDecision = (typeof MULTIWAY_DECISIONS)[number]

const engine = createTablesEngine()

/**
 * A view position, which the export's matches within a px: the view places
 * the anchor at whole px, as its own `bpToPx` does, and every lane frame
 * pivots on that, where the export keeps the fraction (`wholePx: false`) a
 * table of positions wants. That is precision, not a decision.
 */
function nearPx(x: number) {
  return matching(
    `${x} ± 1 px`,
    other => typeof other === 'number' && Math.abs(other - x) <= 1,
  )
}

/**
 * A thin ribbon's faded alpha, which reads its sub-px width and so moves
 * with the view's whole-px anchor: any alpha up to its unfaded one. A ribbon
 * a px or more wide fades by nothing and compares exactly.
 */
function fadedUpTo(alpha: number) {
  return matching(
    `a faded alpha up to ${alpha}`,
    other => typeof other === 'number' && other > 0 && other <= alpha + 1e-4,
  )
}

const anyFlag = matching('either flag', other => typeof other === 'boolean')

function matching(name: string, test: (other: unknown) => boolean) {
  return {
    $$typeof: Symbol.for('jest.asymmetricMatcher'),
    asymmetricMatch: test,
    toAsymmetricMatcher: () => name,
  }
}

const rounded = (value: number) => Math.round(value * 1e4) / 1e4

const roundedPx = (value: number) => Math.round(value * 1e3) / 1e3

/**
 * A lane's line across the view: the stack draws it a screen either side so
 * a pan finds it drawn, a viewport policy a static export has no use for. A
 * lane with no contig picked draws a bare rule, no stretch of sequence, so
 * only the anchor's and a framed lane's line compare.
 */
function onView(a: number, b: number, width: number) {
  const left = Math.max(Math.min(a, b), 0)
  const right = Math.min(Math.max(a, b), width)
  return left < right ? [[roundedPx(left), roundedPx(right)]] : []
}

const columnName = (name: string) => (name === 'mappingQual' ? 'mapq' : name)

const RECORD_COLUMNS = new Set([
  'id',
  'group',
  'name',
  'assembly',
  'chrom',
  'start',
  'end',
  'strand',
  'mateAssembly',
  'mateChrom',
  'mateStart',
  'mateEnd',
])

const byBlock = (
  a: { lane: number; group: string; start: number },
  b: { lane: number; group: string; start: number },
) => a.lane - b.lane || a.group.localeCompare(b.group) || a.start - b.start

function rowsOf<T extends Record<string, unknown[]>>(table: T) {
  const n = Object.values(table)[0]?.length ?? 0
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v[i]])),
  )
}

/**
 * The multi-way display under a linear genome view beside
 * `engine.multiway` over one fixture: the lanes it stacks with the contig,
 * zoom, orientation and band each picked, each lane's line, the blocks each
 * group places on each lane, every ribbon's corners, color and faded alpha
 * in paint order, the records the ribbons draw and the measurements they
 * carry, the key, the stack's height, the tick interval and whether each
 * gutter reads against the anchor.
 */
function multiwayParity(
  fixture: MultiwayFixture,
): ParityAdapter<
  MultiwayCase,
  MultiwayModel,
  MultiWayTables,
  MultiwayDecision
> {
  const { width } = fixture.anchor
  return {
    decisionNames: MULTIWAY_DECISIONS,
    buildModel: async ({ display = {}, pins, hidden }) => {
      const model = await standUpMultiway({
        adapterConfig: fixture.adapterConfig,
        assemblies: fixture.assemblies,
        anchor: fixture.anchor,
        settings: display,
        pins,
        hidden,
      })
      return { model, dispose: model.dispose }
    },
    buildExport: args =>
      engine.multiway({
        adapterConfig: fixture.adapterConfig,
        anchor: fixture.anchor,
        ...args,
      }),
    modelDecisions: ({ display }) => {
      const stack = display.laneStack
      const anchorChroms = [
        ...new Set(fixture.anchor.regions.map(r => r.refName)),
      ].join(',')
      const geometry = display.ribbonGeometry
      const ribbons = geometry.layers.flatMap(layer => {
        const cell = geometry.cells.get(layer.key)
        if (cell?.kind !== 'ribbons') {
          return []
        }
        const [row, toRow] = layer.rows
        const d = cell.data
        return Array.from({ length: d.instanceCount }, (_, i) => i).flatMap(
          i => {
            const packed = d.colors[i] ?? 0
            const corners = {
              sx1: d.bp1[i] ?? 0,
              sx2: d.bp2[i] ?? 0,
              sx3: d.bp3[i] ?? 0,
              sx4: d.bp4[i] ?? 0,
            }
            const kind = d.kinds[i] ?? 0
            const { thin } = ribbonThinFade(
              corners,
              layer.height,
              layer.curves,
              kind,
              MULTIWAY_FADE_THIN,
            )
            const { color, alpha } = unpack(packed)
            const target = geometry.targets[d.instanceFeatureIdx[i] ?? 0]
            return packed >>> 24 === 0
              ? []
              : [
                  {
                    alignment: target?.feature.id(),
                    gutter: row,
                    upperLane: display.rowsVsAnchor && row > 0 ? 0 : row,
                    lowerLane: toRow,
                    kind: kind === KIND_BASE_TILE ? 'mismatch' : 'match',
                    corners: [
                      corners.sx1,
                      corners.sx2,
                      corners.sx4,
                      corners.sx3,
                    ].map(nearPx),
                    y: [layer.yTop, layer.yTop + layer.height],
                    color,
                    alpha: thin ? fadedUpTo(alpha) : rounded(alpha),
                    thin: thin ? anyFlag : false,
                  },
                ]
          },
        )
      })
      return {
        lanes: stack.lanes.map(l => ({
          assembly: l.assemblyName,
          label: l.label,
          anchor: l.isAnchor,
          chrom: l.isAnchor ? anchorChroms : (l.frame?.refName ?? null),
          flipped: l.frame?.flipped ?? false,
          bpPerPx: rounded(l.bpPerPx),
          alsoOn: l.frame?.alsoOn.join(',') ?? '',
          yTop: l.glyphTop,
          yBottom: l.glyphTop + stack.glyphHeight,
        })),
        segments: stack.lanes.map(l =>
          l.isAnchor || l.frame
            ? l.baseline.flatMap(([a, b]) =>
                onView(a, b, width).map(s => s.map(nearPx)),
              )
            : [],
        ),
        blocks: stack.lanes
          .flatMap((lane, i) =>
            [...lane.placements].flatMap(
              ([group, { spans, intervals, orientations }]) =>
                intervals.map((interval, j) => ({
                  lane: i,
                  group,
                  name: interval.name ?? null,
                  chrom: interval.refName,
                  start: interval.start,
                  end: interval.end,
                  strand: orientations[j],
                  x: (spans[j] ?? [0, 0]).map(nearPx),
                })),
            ),
          )
          .sort(byBlock),
        ribbons,
        alignments: geometry.targets.map(t => ({
          id: t.feature.id(),
          group: t.groupKey ?? t.linkId ?? '',
        })),
        columns: Object.keys(display.ribbonAttributeRanges)
          .map(columnName)
          .sort(),
        key: (() => {
          const { legend, legendTitle, ramps } = colorKeyTables(
            display.colorScales,
          )
          return {
            title: legendTitle,
            chips: legend.label.map((label, i) => ({
              label,
              color: legend.color[i],
            })),
            ramps,
          }
        })(),
        height: display.stackGeometry.contentHeight,
        tickInterval: display.tickIntervalBp,
        rowsVsAnchor: display.rowsVsAnchor,
      }
    },
    exportDecisions: t => {
      const lanes = rowsOf(t.lanes)
      const segments = lanes.map((_, i) =>
        t.segments.lane.flatMap((lane, k) =>
          lane === i
            ? onView(t.segments.x1[k] ?? 0, t.segments.x2[k] ?? 0, width)
            : [],
        ),
      )
      const r = t.ribbons
      return {
        lanes: lanes.map(l => ({
          assembly: l.assembly,
          label: l.label,
          anchor: l.anchor,
          chrom: l.chrom,
          flipped: l.flipped,
          bpPerPx:
            typeof l.bpPerPx === 'number' ? rounded(l.bpPerPx) : l.bpPerPx,
          alsoOn: l.alsoOn,
          yTop: l.yTop,
          yBottom: l.yBottom,
        })),
        segments,
        blocks: t.blocks.lane
          .map((lane, i) => ({
            lane,
            group: t.blocks.group[i] ?? '',
            name: t.blocks.name[i] ?? null,
            chrom: t.blocks.chrom[i],
            start: t.blocks.start[i] ?? 0,
            end: t.blocks.end[i],
            strand: t.blocks.strand[i],
            x: [t.blocks.x1[i] ?? 0, t.blocks.x2[i] ?? 0],
          }))
          .sort(byBlock),
        ribbons: r.alignment.map((alignment, i) => ({
          alignment: t.alignments.id[alignment],
          gutter: r.gutter[i],
          upperLane: r.upperLane[i],
          lowerLane: r.lowerLane[i],
          kind: r.kind[i],
          corners: [
            r.upperX1[i] ?? 0,
            r.upperX2[i] ?? 0,
            r.lowerX1[i] ?? 0,
            r.lowerX2[i] ?? 0,
          ],
          y: [r.yTop[i], r.yBottom[i]],
          color: r.color[i],
          alpha: rounded(r.alpha[i] ?? 0),
          thin: r.thin[i],
        })),
        alignments: t.alignments.id.map((id, i) => ({
          id,
          group: t.alignments.group[i],
        })),
        columns: Object.keys(t.alignments)
          .filter(name => !RECORD_COLUMNS.has(name))
          .sort(),
        key: {
          title: t.legendTitle,
          chips: t.legend.label.map((label, i) => ({
            label,
            color: t.legend.color[i],
          })),
          ramps: t.ramps,
        },
        height: t.height,
        tickInterval: t.tickInterval,
        rowsVsAnchor: t.rowsVsAnchor,
      }
    },
  }
}

/**
 * The export runs each mate lane's line to the edge of the view, where the
 * view stops it at the end of the lane's contig: the stack reads the
 * contig's length off the lane's assembly, which the export is never given.
 */
function pastContigEnd(exported: number[][][]) {
  return {
    segments: { owner: 'multiway lane contig extents', exported },
  }
}

const VOLVOX_SEGMENTS = [[[0, 800]], [[0, 800]], [[38.879, 800]]]

describe('volvox, an insertion and a deletion, all against all', () => {
  parityCases(multiwayParity(ALL_VS_ALL_LANES), [
    {
      name: 'defaults',
      config: {},
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'strand, bump curves',
      config: {
        display: {
          ribbons: {
            encoding: { color: { field: 'strand' } },
            mark: { interpolate: 'bump' },
          },
        },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'identity',
      config: {
        display: { ribbons: { encoding: { color: { field: 'identity' } } } },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'a constant at an opacity',
      config: {
        display: {
          ribbons: { encoding: { color: { value: '#008000' }, opacity: 0.6 } },
        },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'filter by identity',
      config: {
        display: { ribbons: { filter: [{ field: 'identity', gte: 0.95 }] } },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'rows.sort',
      config: { display: { rows: { sort: ['volvox_del'] } } },
      drifts: pastContigEnd([[[0, 800]], [[38.879, 800]], [[0, 800]]]),
    },
    {
      name: 'rows.kept',
      config: { display: { rows: { kept: ['volvox_del'] } } },
      drifts: pastContigEnd([[[0, 800]], [[38.879, 800]]]),
    },
    {
      name: 'a hidden lane',
      config: { hidden: ['volvox_ins'] },
      drifts: pastContigEnd([[[0, 800]], [[38.879, 800]]]),
    },
    {
      name: 'a tall stack',
      config: { display: { height: 900 } },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
    {
      name: 'no gene names, lane names over the lanes',
      config: {
        display: {
          labels: { name: { show: false }, lanes: { placement: 'overlay' } },
        },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
  ])
})

describe('4 kb around the insertion', () => {
  parityCases(multiwayParity(ALL_VS_ALL_ZOOMED), [
    { name: 'defaults', config: {} },
    {
      name: 'strand',
      config: {
        display: { ribbons: { encoding: { color: { field: 'strand' } } } },
      },
    },
    {
      name: 'opacity by identity',
      config: {
        display: { ribbons: { encoding: { opacity: { field: 'identity' } } } },
      },
    },
  ])
})

describe('two pairwise files against volvox', () => {
  parityCases(multiwayParity(STAR_LANES), [
    { name: 'defaults', config: {}, drifts: pastContigEnd(VOLVOX_SEGMENTS) },
    {
      name: 'strand',
      config: {
        display: { ribbons: { encoding: { color: { field: 'strand' } } } },
      },
      drifts: pastContigEnd(VOLVOX_SEGMENTS),
    },
  ])
})

const SYRI_COLORS = {
  ribbons: {
    encoding: {
      color: {
        field: 'syri',
        scale: { domain: ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP'] },
      },
    },
  },
}

const SYRI_ORDER = { sort: ['Ler', 'Cvi', 'Eri', 'Kyo', 'Sha'] }

/** Col-0, Ler, Cvi on the contig given, Eri, Kyo and Sha */
const syriSegments = (cvi: number[][]) => [
  [[0, 800]],
  [[8.495, 800]],
  cvi,
  [[30.227, 800]],
  [
    [16.084, 417.585],
    [419.047, 800],
  ],
  [[3.078, 800]],
]

const CVI_CHR1 = [
  [3.918, 409.52],
  [409.995, 800],
]

describe("SyRI's calls for five accessions under Col-0", () => {
  parityCases(multiwayParity(SYRI_LANES), [
    {
      name: 'colored by call, lanes in order',
      config: { display: { ...SYRI_COLORS, rows: SYRI_ORDER } },
      drifts: pastContigEnd(syriSegments(CVI_CHR1)),
    },
    {
      name: 'a lane pinned to another contig',
      config: {
        display: { ...SYRI_COLORS, rows: SYRI_ORDER },
        pins: [{ lane: 'Cvi', refName: 'Chr2' }],
      },
      drifts: pastContigEnd(syriSegments([[363.734, 800]])),
    },
    {
      name: 'a categorical scheme',
      config: {
        display: {
          ribbons: {
            encoding: {
              color: {
                field: 'syri',
                scale: {
                  domain: ['SYN', 'INV', 'TRANS', 'INVTR', 'DUP', 'INVDP'],
                  scheme: 'viridis',
                },
              },
            },
          },
          rows: SYRI_ORDER,
        },
      },
      drifts: pastContigEnd(syriSegments(CVI_CHR1)),
    },
    {
      name: 'names, a title, descending',
      config: {
        display: {
          ribbons: {
            encoding: {
              color: {
                field: 'syri',
                scale: {
                  domain: ['SYN', 'INV'],
                  names: ['Syntenic', 'Inverted'],
                },
                legend: { title: 'Call', descending: true },
              },
            },
          },
          rows: SYRI_ORDER,
        },
      },
      drifts: pastContigEnd(syriSegments(CVI_CHR1)),
    },
    {
      name: 'filter to inversions',
      config: {
        display: {
          ribbons: {
            ...SYRI_COLORS.ribbons,
            filter: [{ field: 'syri', oneOf: ['INV'] }],
          },
          rows: SYRI_ORDER,
        },
      },
      drifts: pastContigEnd(syriSegments(CVI_CHR1)),
    },
    {
      name: 'lane labels',
      config: {
        display: {
          ...SYRI_COLORS,
          rows: {
            ...SYRI_ORDER,
            labels: { Ler: 'Landsberg', Cvi: 'Cape Verde' },
          },
        },
      },
      drifts: pastContigEnd(syriSegments(CVI_CHR1)),
    },
  ])
})

/**
 * A reference-anchored file asked for two accessions side by side: the view
 * notes the one gutter it cannot fill and draws the rest, where the export
 * fails the whole call, as multiwayTables.test.ts asks of it. Pinned rather
 * than compared until one of the two is chosen.
 */
test('a lane pair the file lacks (drift: multiway failed lane pairs)', async () => {
  const settings = { ...SYRI_COLORS, rows: { kept: ['Eri', 'Ler'] } }
  const laneFailure = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { display, dispose } = await standUpMultiway({
    adapterConfig: SYRI_LANES.adapterConfig,
    assemblies: SYRI_LANES.assemblies,
    anchor: SYRI_LANES.anchor,
    settings,
  })
  try {
    expect(display.rowAssemblies).toEqual(['Eri', 'Ler'])
    expect(display.failedGutters).toHaveLength(1)
    expect(display.ribbonGeometry.targets.length).toBeGreaterThan(0)
    expect(laneFailure).toHaveBeenCalledWith(
      'MultiWayLaneLinks: one lane failed',
      expect.any(Error),
    )
  } finally {
    laneFailure.mockRestore()
    dispose()
  }
  await expect(
    engine.multiway({
      adapterConfig: SYRI_LANES.adapterConfig,
      anchor: SYRI_LANES.anchor,
      display: settings,
    }),
  ).rejects.toThrow('This file contains no alignments between "Eri" and "Ler"')
}, 60_000)

describe('volvox ctgB, which no lane aligns to', () => {
  parityCases(multiwayParity(ALL_VS_ALL_UNALIGNED), [
    { name: 'defaults', config: {} },
    {
      name: 'rows.kept',
      config: { display: { rows: { kept: ['volvox_del'] } } },
    },
  ])
})

describe('a gene table, grape under peach and cacao', () => {
  parityCases(multiwayParity(GENE_BLOCK_LANES), [
    { name: 'defaults', config: {} },
    {
      name: 'strand',
      config: {
        display: { ribbons: { encoding: { color: { field: 'strand' } } } },
      },
    },
  ])
})
