import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { lowerBoundOf } from '@jbrowse/core/util/fieldPredicate'
import { measureText } from '@jbrowse/core/util/measureText'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'
import {
  FADE_AUTO_MIN_FEATURES,
  attributeColumns,
  axesNamePositionFor,
  axisNamePosition,
  bandGroundColor,
  cappedMeanWidthPx,
  comparativeAxis,
  comparativeLegend,
  fadesThinAt,
  isInstanceInvisible,
  locateCum,
  liftSyntenyViewSettings,
  resolvedIndels,
  unpack,
  viewColorSettings,
} from '@jbrowse/synteny-core'

import {
  MIN_CONTIG_MARK_PX,
  drawOffscreenMates,
  offscreenMateColors,
} from './LinearSyntenyDisplay/drawOffscreenMates.ts'
import {
  computeSyntenyColors,
  createSyntenyColorFunction,
} from './LinearSyntenyDisplay/syntenyColors.ts'
import { ribbonThinFade } from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { executeSyntenyFeaturesAndPositions } from './LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts'
import { computePresentCigarKinds } from './LinearSyntenyRPC/presentCigarKinds.ts'
import {
  KIND_BASE,
  KIND_BASE_TILE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  KIND_MARKER,
} from './LinearSyntenyRPC/syntenyKinds.ts'
import { DEFAULT_ALPHA } from './LinearSyntenyView/consts.ts'
import { offscreenMateMarkColorFor } from './LinearSyntenyViewHelper/offscreenMateMarkColors.ts'
import { offscreenMateSummary } from './LinearSyntenyViewHelper/offscreenMateStrip.ts'

import type { OffscreenMateLane } from './LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { OffscreenMateData } from './LinearSyntenyRPC/collectOffscreenMates.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  AxisArgs,
  ColorArg,
  ComparativeAxis,
  FilterArg,
  IndelsArg,
  OpacityArg,
  RefNamePosition,
  RibbonInterpolation,
} from '@jbrowse/synteny-core'

export { registerComparativeAdapters }
export { multiwayTables } from './multiwayTables.ts'
export type { MultiWayTables, MultiWayTablesArgs } from './multiwayTables.ts'

export interface SyntenyTablesArgs {
  adapterConfig: Record<string, unknown>
  /** the upper row, the adapter's query side unless it names an assembly */
  query: AxisArgs
  /** the lower row, the adapter's target side unless it names an assembly */
  target: AxisArgs
  /**
   * The view's settings, as a `LinearSyntenyView` snapshot writes them:
   * `encoding` (`color`, a field such as `'strand'` or the color channel's
   * slots, and `opacity`, a number or the opacity channel),
   * `filter` (a list of field predicates), `indels` (`show`, and
   * `encoding.opacity` 0 to leave each indel a gap),
   * `mark` (`interpolate`: `linear` or `bump`), `axis` (`grid` draws the
   * location markers), `render` (`antialias`: `true`, `false`, or unset to
   * follow the data) and the level's `height` in px, which the thin-ribbon
   * fade measures against.
   */
  view?: {
    encoding?: { color?: ColorArg; opacity?: OpacityArg }
    filter?: FilterArg
    indels?: IndelsArg
    mark?: { interpolate?: RibbonInterpolation }
    axis?: { grid?: boolean }
    render?: { antialias?: boolean }
    height?: number
  }
}

const KIND_NAMES: Record<number, string> = {
  [KIND_BASE]: 'match',
  [KIND_BASE_TILE]: 'match',
  [KIND_CIGAR_I]: 'insertion',
  [KIND_CIGAR_D]: 'deletion',
  [KIND_CIGAR_N]: 'skip',
  [KIND_MARKER]: 'marker',
}

const DEFAULT_LEVEL_HEIGHT = 100

interface OffscreenLane {
  data: OffscreenMateData
  axis: 'query' | 'target'
  on: ComparativeAxis
  // the contig color the strip paints a mark in, absent for the band's grey
  markColorFor?: (refName: string) => string
  colorOf: (refName: string) => { color: string; alpha: number }
  minAlignmentLength: number
}

// The lane the display hangs off a row's edge, its marks in the colors
// `offscreenMateMarkColorFor` gives them: a contig's ribbon color where the
// ribbons are keyed by the axis the mate is on, the band's grey otherwise
function offscreenLane(
  data: OffscreenMateData,
  axis: 'query' | 'target',
  on: ComparativeAxis,
  {
    field,
    namePosition,
    minAlignmentLength,
  }: {
    field: string | undefined
    namePosition?: RefNamePosition
    minAlignmentLength: number
  },
): OffscreenLane {
  const markColorFor = offscreenMateMarkColorFor(
    [{ paintedField: field, paintedRefNamePosition: namePosition }],
    axis === 'query' ? 'top' : 'bottom',
  )
  const grey = offscreenMateColors(bandGroundColor()).markColor
  return {
    data,
    axis,
    on,
    markColorFor,
    colorOf: refName => unpack(cssColorToABGR(markColorFor?.(refName) ?? grey)),
    minAlignmentLength,
  }
}

const LABEL_FONT_PX = 10

// A context that keeps what `drawOffscreenMates` paints: each rect of a filled
// path in that fill's color, and each label at its baseline in its ink, the
// halo stroked under it in the band's ground
function recordingContext() {
  let path: [number, number, number, number][] = []
  const marks = {
    x: [] as number[],
    y: [] as number[],
    width: [] as number[],
    height: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
  }
  const labels = {
    label: [] as string[],
    x: [] as number[],
    y: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
    halo: [] as string[],
  }
  let halo = ''
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: '',
    lineWidth: 0,
    lineJoin: '',
    beginPath() {
      path = []
    },
    rect(x: number, y: number, w: number, h: number) {
      path.push([x, y, w, h])
    },
    fill() {
      const { color, alpha } = unpack(cssColorToABGR(ctx.fillStyle))
      for (const [x, y, w, h] of path) {
        marks.x.push(x)
        marks.y.push(y)
        marks.width.push(w)
        marks.height.push(h)
        marks.color.push(color)
        marks.alpha.push(alpha)
      }
      path = []
    },
    strokeText() {
      halo = unpack(cssColorToABGR(ctx.strokeStyle)).color
    },
    fillText(text: string, x: number, y: number) {
      const { color, alpha } = unpack(cssColorToABGR(ctx.fillStyle))
      labels.label.push(text)
      labels.x.push(x)
      labels.y.push(y)
      labels.color.push(color)
      labels.alpha.push(alpha)
      labels.halo.push(halo)
    },
  }
  return { ctx: ctx as unknown as Ctx2D, marks, labels }
}

// The strip as the band paints it over its `height` px: every mark, in px
// from the band's top left, and every label the strips have room for, in the
// display's 10px sans-serif
function offscreenStrip(
  lanes: readonly OffscreenLane[],
  { width, height }: { width: number; height: number },
) {
  const strips: OffscreenMateLane[] = lanes
    .filter(lane => lane.data.starts.length > 0)
    .map(lane => ({
      datasets: [lane.data],
      mateBand: { lo: -Infinity, hi: Infinity },
      bpPerPx: lane.on.bpPerPx,
      offsetPx: 0,
      side: lane.axis === 'query' ? 'top' : 'bottom',
      minAlignmentLength: lane.minAlignmentLength,
      markColorFor: lane.markColorFor,
      width,
      height,
    }))
  const { ctx, marks, labels } = recordingContext()
  drawOffscreenMates(ctx, strips, {
    ...offscreenMateColors(bandGroundColor()),
    measure: text => measureText(text, LABEL_FONT_PX),
  })
  const axisAt = (y: number) => (y < height / 2 ? 'query' : 'target')
  return {
    marks: {
      axis: marks.y.map((y, i) => axisAt(y + marks.height[i]! / 2)),
      ...marks,
    },
    labels: { axis: labels.y.map(axisAt), ...labels },
    fontPx: LABEL_FONT_PX,
  }
}

// The blocks placed on one axis whose mate the other row does not show, each
// back on the region of that axis its clamped span lies in, in the color the
// strip paints it and whether it clears the strip's floors
function offscreenRows({
  data,
  axis,
  on,
  colorOf,
  minAlignmentLength,
}: OffscreenLane) {
  const n = data.starts.length
  const from = Array.from(data.starts, (s, i) => locateCum(on, s, data.ends[i]))
  const to = Array.from(data.ends, (e, i) => locateCum(on, e, data.starts[i]))
  const mateChrom = Array.from(
    data.mateRefNameIds,
    id => data.mateRefNameDict[id]!,
  )
  const paint = mateChrom.map(colorOf)
  const contigFloor = MIN_CONTIG_MARK_PX * on.bpPerPx
  return {
    axis: Array.from({ length: n }, () => axis),
    region: from.map(p => p.region),
    chrom: from.map(p => on.regions[p.region]!.refName),
    start: from.map((p, i) => Math.min(p.coord, to[i]!.coord)),
    end: from.map((p, i) => Math.max(p.coord, to[i]!.coord)),
    mateChrom,
    mateStart: Array.from(data.mateStarts),
    mateEnd: Array.from(data.mateEnds),
    length: Array.from(data.lengths),
    color: paint.map(p => p.color),
    alpha: paint.map(p => p.alpha),
    drawn: Array.from(
      data.mateRefNameIds,
      (id, i) =>
        data.lengths[i]! >= minAlignmentLength &&
        (data.alignedBp[id] ?? Infinity) >= contigFloor,
    ),
  }
}

// Each contig a lane's mates lie on, with what the strip's hover reports of
// it: the alignments to it, the sequence they cover, and the line it prints
function offscreenContigRows({ data, axis, colorOf }: OffscreenLane) {
  const paint = data.mateRefNameDict.map(colorOf)
  const count = Array.from(data.counts)
  const alignedBp = Array.from(data.alignedBp)
  return {
    axis: data.mateRefNameDict.map(() => axis),
    mateChrom: [...data.mateRefNameDict],
    count,
    alignedBp,
    label: data.mateRefNameDict.map((name, i) =>
      offscreenMateSummary(name, {
        alignments: count[i]!,
        alignedBp: alignedBp[i]!,
      }),
    ),
    color: paint.map(p => p.color),
    alpha: paint.map(p => p.alpha),
  }
}

function concatColumns<T extends Record<string, unknown[]>>(a: T, b: T) {
  for (const key of Object.keys(a)) {
    a[key]!.push(...b[key]!)
  }
  return a
}

/**
 * #api
 * A pair of rows of a linear synteny view as the display fetches, lays out
 * and colors it, as tables: `alignments`, each alignment block the two rows
 * share, with its span on each, its strand, name and measurements, in the
 * color the view's `encoding.color` paints it; `ribbons`, what the band draws between
 * the rows in paint order, each a trapezoid from a span on the query row to
 * a span on the target row (`match` for the block, `insertion`, `deletion`
 * and `skip` for the CIGAR ops wide enough to draw, `marker` for a location
 * tick), with its color and the alpha it composites at, and whether it draws
 * as a centerline; `offscreen`, the blocks whose mate lies on a contig the
 * other row is not showing, in the color the strip along that row's edge
 * paints them, `offscreenContigs`, the count and aligned bp of each such
 * contig and the line its hover prints, and `offscreenStrip`, the marks and
 * labels the strips along the band's edges paint, in px;
 * `legend` and `ramps`, the key; and `config`, the view's settings with
 * their defaults filled, `encoding.color` and `encoding.opacity` as config objects. For a host that draws
 * them itself, such as R through V8. Positions are genomic, on the axis's
 * region named by `queryRegion` and `targetRegion`.
 */
export async function syntenyTables(
  pluginManager: PluginManager,
  { adapterConfig, query, target, view: written = {} }: SyntenyTablesArgs,
) {
  const view = liftSyntenyViewSettings(written) as typeof written
  const q = comparativeAxis(query, adapterConfig, 0)
  const t = comparativeAxis(target, adapterConfig, 1)
  const indels = resolvedIndels(view.indels)
  const config = {
    filter: view.filter ?? [],
    indels: indels.settings,
    mark: { interpolate: view.mark?.interpolate ?? 'linear' },
    axis: { grid: view.axis?.grid ?? false },
    render: { antialias: view.render?.antialias },
    height: view.height ?? DEFAULT_LEVEL_HEIGHT,
  }
  const { height } = config
  const { value } = await executeSyntenyFeaturesAndPositions({
    pluginManager,
    sessionId: 'tables',
    adapterConfig,
    queryView: {
      bpPerPx: q.bpPerPx,
      offsetPx: 0,
      displayedRegions: q.regions,
      width: query.width,
      fetchRegions: q.regions,
    },
    targetView: {
      bpPerPx: t.bpPerPx,
      offsetPx: 0,
      displayedRegions: t.regions,
      windowRegions: t.regions,
      fetchRegions: t.regions,
    },
    cigarMode: indels.drawing,
    statusCallback: () => {},
  })
  const { instanceData, ...featureData } = value
  const settings = viewColorSettings({
    color: view.encoding?.color,
    opacity: view.encoding?.opacity,
    defaultOpacity: DEFAULT_ALPHA,
    attributeRanges: featureData.attributeRanges,
  })
  const colorArgs = {
    field: settings.field,
    trackColor: settings.trackColor,
    namePosition: axesNamePositionFor(settings.field, [q, t]),
    attributeRanges: settings.attributeRanges,
    paint: settings.paint,
    opacity: settings.fade,
    filter: config.filter,
    filterExtras: {
      lengthOf: (i: number) =>
        Math.abs(featureData.ends[i]! - featureData.starts[i]!),
    },
  }
  const colors = computeSyntenyColors({
    instanceData,
    featureData,
    ...colorArgs,
    valueColor: settings.valueColor,
    axisGrid: config.axis.grid,
    groundColor: bandGroundColor(),
  })
  const featureColor = createSyntenyColorFunction({
    ...colorArgs,
    data: featureData,
    valueColor: settings.valueColor,
  })

  const n = featureData.featureIds.length
  const minLength = lowerBoundOf(config.filter, 'length') ?? 0
  const mode = config.render.antialias
  const fadeThin =
    mode === undefined
      ? fadesThinAt(
          n >= FADE_AUTO_MIN_FEATURES
            ? cappedMeanWidthPx(featureData.starts, featureData.ends, q.bpPerPx)
            : Infinity,
          false,
        )
      : mode
  const level = settings.level
  const curves = config.mark.interpolate === 'bump'

  const named = (dict: readonly string[], ids: ArrayLike<number>) =>
    Array.from(ids, id => dict[id]!)
  const alignments = {
    id: featureData.featureIds,
    name: named(featureData.nameDict, featureData.nameIds),
    queryChrom: named(featureData.refNameDict, featureData.refNameIds),
    queryStart: Array.from(featureData.starts),
    queryEnd: Array.from(featureData.ends),
    targetChrom: named(featureData.mateRefNameDict, featureData.mateRefNameIds),
    targetStart: Array.from(featureData.mateStarts),
    targetEnd: Array.from(featureData.mateEnds),
    strand: Array.from(featureData.strands),
    length: Array.from(featureData.starts, (s, i) =>
      Math.abs(featureData.ends[i]! - s),
    ),
    ...attributeColumns(featureData.attributes, featureData.attributeRanges),
    color: [] as string[],
    alpha: [] as number[],
  }
  for (let i = 0; i < n; i++) {
    const { color, alpha } = unpack(featureColor(i))
    alignments.color.push(color)
    alignments.alpha.push(alpha * level)
  }

  const ribbons = {
    alignment: [] as number[],
    kind: [] as string[],
    queryRegion: [] as number[],
    queryChrom: [] as string[],
    queryStart: [] as number[],
    queryEnd: [] as number[],
    targetRegion: [] as number[],
    targetChrom: [] as string[],
    targetStart: [] as number[],
    targetEnd: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
    thin: [] as boolean[],
  }
  const { bp1, bp2, bp3, bp4, base0, base1, kinds, instanceFeatureIdx } =
    instanceData
  const corners = { sx1: 0, sx2: 0, sx3: 0, sx4: 0 }
  const place = (axis: ComparativeAxis, a: number, b: number) => {
    const from = locateCum(axis, a, b)
    const to = locateCum(axis, b, a)
    return { region: from.region, from: from.coord, to: to.coord }
  }
  for (let i = 0; i < instanceData.instanceCount; i++) {
    const kind = kinds[i]!
    const marker = kind === KIND_MARKER
    const packed = colors[i]!
    if (isInstanceInvisible(packed, marker ? 1 : level)) {
      continue
    }
    const c1 = bp1[i]! + base0
    const c2 = bp2[i]! + base0
    const c3 = bp3[i]! + base1
    const c4 = bp4[i]! + base1
    corners.sx1 = c1 / q.bpPerPx
    corners.sx2 = c2 / q.bpPerPx
    corners.sx3 = c3 / t.bpPerPx
    corners.sx4 = c4 / t.bpPerPx
    const { thin, fade } = marker
      ? { thin: true, fade: 1 }
      : ribbonThinFade(corners, height, curves, kind, fadeThin)
    const { color, alpha } = unpack(packed)
    const qs = place(q, c1, c2)
    const ts = place(t, c4, c3)
    ribbons.alignment.push(instanceFeatureIdx[i]!)
    ribbons.kind.push(KIND_NAMES[kind] ?? 'match')
    ribbons.queryRegion.push(qs.region)
    ribbons.queryChrom.push(q.regions[qs.region]!.refName)
    ribbons.queryStart.push(qs.from)
    ribbons.queryEnd.push(qs.to)
    ribbons.targetRegion.push(ts.region)
    ribbons.targetChrom.push(t.regions[ts.region]!.refName)
    ribbons.targetStart.push(ts.from)
    ribbons.targetEnd.push(ts.to)
    ribbons.color.push(color)
    ribbons.alpha.push(alpha * (marker ? 1 : level) * fade)
    ribbons.thin.push(thin)
  }

  const lanes = [
    offscreenLane(featureData.offscreenMates, 'query', q, {
      field: settings.field,
      namePosition: axisNamePosition(t),
      minAlignmentLength: minLength,
    }),
    offscreenLane(featureData.targetOffscreenMates, 'target', t, {
      field: settings.field,
      namePosition: axisNamePosition(q),
      minAlignmentLength: minLength,
    }),
  ] as const
  const offscreen = concatColumns(
    offscreenRows(lanes[0]),
    offscreenRows(lanes[1]),
  )
  const offscreenContigs = concatColumns(
    offscreenContigRows(lanes[0]),
    offscreenContigRows(lanes[1]),
  )

  const cigarOps = computePresentCigarKinds(kinds, instanceData.instanceCount)
  return {
    alignments,
    ribbons,
    offscreen,
    offscreenContigs,
    offscreenStrip: offscreenStrip(lanes, { width: query.width, height }),
    ...comparativeLegend(settings, { cigarOps }),
    config: { ...config, ...settings.config },
    field: settings.field,
    alpha: level,
    fadeThin,
    assemblyNames: [q.assemblyName, t.assemblyName],
    hasCigar: featureData.hasCigar,
  }
}

export type SyntenyTables = Awaited<ReturnType<typeof syntenyTables>>
