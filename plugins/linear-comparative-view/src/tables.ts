import { clamp } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { measureText } from '@jbrowse/core/util/measureText'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'
import {
  FADE_AUTO_MIN_FEATURES,
  attributeColumns,
  axesNamePositionFor,
  axisNamePosition,
  bandGroundColor,
  cappedMeanWidthPx,
  comparativeFrame,
  comparativeLegend,
  fadesThinAt,
  isInstanceInvisible,
  locateCum,
  liftSyntenyViewSettings,
  resolvedIndels,
  unpack,
  viewColorSettings,
} from '@jbrowse/synteny-core'

import { culledRibbonMateData } from './LinearSyntenyDisplay/culledRibbonMates.ts'
import {
  MIN_CONTIG_MARK_PX,
  datasetMayHide,
  drawOffscreenMates,
  laneContigBpByName,
  offscreenMateColors,
  ribbonDrawn,
} from './LinearSyntenyDisplay/drawOffscreenMates.ts'
import {
  computeSyntenyColors,
  createSyntenyColorFunction,
} from './LinearSyntenyDisplay/syntenyColors.ts'
import {
  isRibbonCulled,
  ribbonThinFade,
} from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
import {
  admittedOffscreenMates,
  offscreenMateFilter,
} from './LinearSyntenyRPC/collectOffscreenMates.ts'
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
import {
  DEFAULT_ALPHA,
  DEFAULT_OVERDRAW_PX,
} from './LinearSyntenyView/consts.ts'
import { offscreenMateMarkColorFor } from './LinearSyntenyViewHelper/offscreenMateMarkColors.ts'
import { offscreenMateSummary } from './LinearSyntenyViewHelper/offscreenMateStrip.ts'

import type { CulledRibbonMateData } from './LinearSyntenyDisplay/culledRibbonMates.ts'
import type {
  MateBand,
  OffscreenMateLane,
} from './LinearSyntenyDisplay/drawOffscreenMates.ts'
import type {
  FetchedOffscreenMates,
  OffscreenMateData,
} from './LinearSyntenyRPC/collectOffscreenMates.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
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
  /** the track's name, which a key by `track` labels its chip with */
  trackName?: string
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
  // every entry the worker placed, which the rows list
  fetched: FetchedOffscreenMates
  // the ones the filter admits, which the strip draws and the contigs count
  data: OffscreenMateData
  passes?: (index: number) => boolean
  // every ribbon the band drew geometry for, placed on the facing axis, held
  // while the facing row's band leaves one out (`culledRibbonMates`)
  culled?: CulledRibbonMateData
  // the facing row's window and overdraw, in its cumBp
  mateBand: MateBand
  axis: 'query' | 'target'
  on: ComparativeAxis
  // where the row's window starts in its frame, and how wide it is
  offsetPx: number
  width: number
  // the contig color the strip paints a mark in, absent for the band's grey
  markColorFor?: (refName: string) => string
  colorOf: (refName: string) => { color: string; alpha: number }
}

// The lane the display hangs off a row's edge, its marks in the colors
// `offscreenMateMarkColorFor` gives them: a contig's ribbon color where the
// ribbons are keyed by the axis the mate is on, the band's grey otherwise
function offscreenLane(
  fetched: FetchedOffscreenMates,
  axis: 'query' | 'target',
  on: ComparativeAxis,
  {
    field,
    namePosition,
    filter,
    offsetPx,
    width,
    culled,
    mateBand,
  }: {
    field: string | undefined
    namePosition?: RefNamePosition
    filter: readonly FieldPredicate[]
    offsetPx: number
    width: number
    culled: CulledRibbonMateData | undefined
    mateBand: MateBand
  },
): OffscreenLane {
  const markColorFor = offscreenMateMarkColorFor(
    [{ paintedField: field, paintedRefNamePosition: namePosition }],
    axis === 'query' ? 'top' : 'bottom',
  )
  const grey = offscreenMateColors(bandGroundColor()).markColor
  return {
    fetched,
    data: admittedOffscreenMates(fetched, filter, { axis }),
    passes: offscreenMateFilter(fetched, filter, { axis }),
    culled:
      culled && culled.starts.length > 0 && datasetMayHide(culled, mateBand)
        ? culled
        : undefined,
    mateBand,
    axis,
    on,
    offsetPx,
    width,
    markColorFor,
    colorOf: refName => unpack(cssColorToABGR(markColorFor?.(refName) ?? grey)),
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

// What a lane's strip walks, as the display hangs it: the worker's marks,
// then the band's culled ribbons
function laneDatasets({ data, culled }: OffscreenLane) {
  return [data, ...(culled ? [culled] : [])].filter(d => d.starts.length > 0)
}

// The strip as the band paints it over its `height` px: every mark, in px
// from the band's top left, and every label the strips have room for, in the
// display's 10px sans-serif
function offscreenStrip(
  lanes: readonly OffscreenLane[],
  { width, height }: { width: number; height: number },
) {
  const strips: OffscreenMateLane[] = lanes
    .map(lane => ({ lane, datasets: laneDatasets(lane) }))
    .filter(({ datasets }) => datasets.length > 0)
    .map(({ lane, datasets }) => ({
      datasets,
      mateBand: lane.mateBand,
      bpPerPx: lane.on.bpPerPx,
      offsetPx: lane.offsetPx,
      side: lane.axis === 'query' ? 'top' : 'bottom',
      markColorFor: lane.markColorFor,
      width,
      height,
    }))
  return recordedOffscreenStrips(strips, height)
}

/**
 * #api
 * What `drawOffscreenMates` paints of `strips` over a band `height` px tall:
 * every mark and every label, in px from the band's top left, each named by
 * the axis whose edge it hangs off.
 */
export function recordedOffscreenStrips(
  strips: OffscreenMateLane[],
  height: number,
) {
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

// The blocks placed on one axis whose mate the other row does not show, and
// the ribbons the band culls whose mate lies past the facing row's overdraw,
// each back on the region of that axis its clamped span lies in, in the color
// the strip paints it and whether it clears the strip's floors
function offscreenRows(lane: OffscreenLane) {
  const { fetched, data: admitted, passes, culled, mateBand } = lane
  const contigFloor = MIN_CONTIG_MARK_PX * lane.on.bpPerPx
  const contigBp = laneContigBpByName([admitted, ...(culled ? [culled] : [])])
  const inView = (start: number, end: number) =>
    end / lane.on.bpPerPx - lane.offsetPx >= 0 &&
    start / lane.on.bpPerPx - lane.offsetPx <= lane.width
  const workerRows = markRows(
    lane,
    fetched,
    Array.from(fetched.starts, (_, i) => i).filter(i =>
      inView(
        Math.min(fetched.starts[i]!, fetched.ends[i]!),
        Math.max(fetched.starts[i]!, fetched.ends[i]!),
      ),
    ),
    i => passes?.(i) ?? true,
    contigBp,
    contigFloor,
  )
  return culled
    ? concatColumns(
        workerRows,
        markRows(
          lane,
          culled,
          Array.from(culled.starts, (_, i) => i).filter(
            i =>
              culled.starts[i]! <= culled.ends[i]! &&
              inView(culled.starts[i]!, culled.ends[i]!) &&
              !ribbonDrawn(culled.mateAxis, i, mateBand),
          ),
          () => true,
          contigBp,
          contigFloor,
        ),
      )
    : workerRows
}

function markRows(
  { axis, on, colorOf }: OffscreenLane,
  data: OffscreenMateData,
  rows: number[],
  passes: (index: number) => boolean,
  contigBp: ReadonlyMap<string, number>,
  contigFloor: number,
) {
  const from = rows.map(i => locateCum(on, data.starts[i]!, data.ends[i]))
  const to = rows.map(i => locateCum(on, data.ends[i]!, data.starts[i]))
  const mateChrom = rows.map(
    i => data.mateRefNameDict[data.mateRefNameIds[i]!]!,
  )
  const paint = mateChrom.map(colorOf)
  return {
    axis: rows.map(() => axis),
    region: from.map(p => p.region),
    chrom: from.map(p => on.regions[p.region]!.refName),
    start: from.map((p, k) => Math.min(p.coord, to[k]!.coord)),
    end: from.map((p, k) => Math.max(p.coord, to[k]!.coord)),
    mateChrom,
    mateStart: rows.map(i => data.mateStarts[i]!),
    mateEnd: rows.map(i => data.mateEnds[i]!),
    length: rows.map(i => data.lengths[i]!),
    color: paint.map(p => p.color),
    alpha: paint.map(p => p.alpha),
    drawn: rows.map(
      (i, k) =>
        passes(i) && (contigBp.get(mateChrom[k]!) ?? Infinity) >= contigFloor,
    ),
  }
}

// Each contig a lane's mates lie on, with what the strip's hover reports of
// it: the alignments to it and the sequence they cover, a row for each
// dataset the strip walks, and the line its hover prints, summed over them
function offscreenContigRows(lane: OffscreenLane) {
  const { data, culled, axis, colorOf } = lane
  const datasets = [data, ...(culled ? [culled] : [])]
  const totals = (name: string) =>
    datasets.reduce(
      (sum, d) => {
        const id = d.mateRefNameDict.indexOf(name)
        return id < 0
          ? sum
          : {
              alignments: sum.alignments + (d.counts[id] ?? 0),
              alignedBp: sum.alignedBp + (d.alignedBp[id] ?? 0),
            }
      },
      { alignments: 0, alignedBp: 0 },
    )
  const names = datasets.flatMap(d => d.mateRefNameDict)
  const paint = names.map(colorOf)
  return {
    axis: names.map(() => axis),
    mateChrom: names,
    count: datasets.flatMap(d => Array.from(d.counts)),
    alignedBp: datasets.flatMap(d => Array.from(d.alignedBp)),
    label: names.map(name => offscreenMateSummary(name, totals(name))),
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
 * as a centerline, less those the band culls past its overdraw;
 * `offscreen`, the blocks whose mate lies on a contig the other row is not
 * showing or past its window and overdraw, in the color the strip along
 * that row's edge paints them, `offscreenContigs`, the count and aligned bp
 * of each contig the strip's marks name and the line its hover prints, and `offscreenStrip`, the marks and
 * labels the strips along the band's edges paint, in px;
 * `legend` and `ramps`, the key; and `config`, the view's settings with
 * their defaults filled, `encoding.color` and `encoding.opacity` as config objects. For a host that draws
 * them itself, such as R through V8. Positions are genomic, on the axis's
 * region named by `queryRegion` and `targetRegion`; a ribbon's
 * `queryX1`/`queryX2` and `targetX1`/`targetX2` are its feet in px across
 * the row's `width`, the regions end to end with no gap, each foot clamped
 * to its region, X1 joining X1 along one edge and X2 joining X2.
 */
export async function syntenyTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    trackName,
    query,
    target,
    view: written = {},
  }: SyntenyTablesArgs,
) {
  const view = liftSyntenyViewSettings(written) as typeof written
  const queryFrame = comparativeFrame(query, adapterConfig, 0)
  const targetFrame = comparativeFrame(target, adapterConfig, 1)
  const q = queryFrame.frame
  const t = targetFrame.frame
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
      offsetPx: queryFrame.offsetPx,
      displayedRegions: q.regions,
      width: query.width,
      fetchRegions: queryFrame.fetchRegions,
    },
    targetView: {
      bpPerPx: t.bpPerPx,
      offsetPx: targetFrame.offsetPx,
      displayedRegions: t.regions,
      windowRegions: targetFrame.fetchRegions,
      fetchRegions: targetFrame.fetchRegions,
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
    queryX1: [] as number[],
    queryX2: [] as number[],
    targetX1: [] as number[],
    targetX2: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
    thin: [] as boolean[],
  }
  const { bp1, bp2, bp3, bp4, base0, base1, kinds, instanceFeatureIdx } =
    instanceData
  const corners = { sx1: 0, sx2: 0, sx3: 0, sx4: 0 }
  const place = (
    axis: ComparativeAxis,
    offsetPx: number,
    a: number,
    b: number,
  ) => {
    const from = locateCum(axis, a, b)
    const to = locateCum(axis, b, a)
    const r = axis.regions[from.region]!
    const lo = axis.before[from.region]!
    const hi = lo + r.end - r.start
    return {
      region: from.region,
      from: from.coord,
      to: to.coord,
      x1: clamp(a, lo, hi) / axis.bpPerPx - offsetPx,
      x2: clamp(b, lo, hi) / axis.bpPerPx - offsetPx,
    }
  }
  const drawn = new Set<number>()
  for (let i = 0; i < instanceData.instanceCount; i++) {
    const kind = kinds[i]!
    const marker = kind === KIND_MARKER
    const packed = colors[i]!
    const c1 = bp1[i]! + base0
    const c2 = bp2[i]! + base0
    const c3 = bp3[i]! + base1
    const c4 = bp4[i]! + base1
    corners.sx1 = c1 / q.bpPerPx - queryFrame.offsetPx
    corners.sx2 = c2 / q.bpPerPx - queryFrame.offsetPx
    corners.sx3 = c3 / t.bpPerPx - targetFrame.offsetPx
    corners.sx4 = c4 / t.bpPerPx - targetFrame.offsetPx
    if (isRibbonCulled(corners, query.width, DEFAULT_OVERDRAW_PX, marker)) {
      continue
    }
    drawn.add(instanceFeatureIdx[i]!)
    if (isInstanceInvisible(packed, marker ? 1 : level)) {
      continue
    }
    const { thin, fade } = marker
      ? { thin: true, fade: 1 }
      : ribbonThinFade(corners, height, curves, kind, fadeThin)
    const { color, alpha } = unpack(packed)
    const qs = place(q, queryFrame.offsetPx, c1, c2)
    const ts = place(t, targetFrame.offsetPx, c4, c3)
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
    ribbons.queryX1.push(qs.x1)
    ribbons.queryX2.push(qs.x2)
    ribbons.targetX1.push(ts.x1)
    ribbons.targetX2.push(ts.x2)
    ribbons.color.push(color)
    ribbons.alpha.push(alpha * (marker ? 1 : level) * fade)
    ribbons.thin.push(thin)
  }

  const named = (dict: readonly string[], ids: ArrayLike<number>) =>
    Array.from(ids, id => dict[id]!)
  const rows = [...drawn].sort((a, b) => a - b)
  const rowOf = new Map(rows.map((f, row) => [f, row]))
  function pick<T>(column: ArrayLike<T>) {
    return rows.map(f => column[f]!)
  }
  const attributes = attributeColumns(
    featureData.attributes,
    featureData.attributeRanges,
  )
  const paints = rows.map(f => unpack(featureColor(f)))
  const alignments = {
    id: pick(featureData.featureIds),
    name: named(featureData.nameDict, pick(featureData.nameIds)),
    queryChrom: named(featureData.refNameDict, pick(featureData.refNameIds)),
    queryStart: pick(featureData.starts),
    queryEnd: pick(featureData.ends),
    targetChrom: named(
      featureData.mateRefNameDict,
      pick(featureData.mateRefNameIds),
    ),
    targetStart: pick(featureData.mateStarts),
    targetEnd: pick(featureData.mateEnds),
    strand: pick(featureData.strands),
    length: rows.map(f =>
      Math.abs(featureData.ends[f]! - featureData.starts[f]!),
    ),
    ...Object.fromEntries(
      Object.entries(attributes).map(([key, column]) => [key, pick(column)]),
    ),
    color: paints.map(p => p.color),
    alpha: paints.map(p => p.alpha * level),
  }

  ribbons.alignment = ribbons.alignment.map(f => rowOf.get(f)!)

  const culled = culledRibbonMateData(
    instanceData,
    featureData,
    config.filter.length > 0 || settings.fade !== undefined
      ? colors
      : undefined,
  )
  const bandOf = (axis: ComparativeAxis, offsetPx: number) => ({
    lo: (offsetPx - DEFAULT_OVERDRAW_PX) * axis.bpPerPx,
    hi: (offsetPx + query.width + DEFAULT_OVERDRAW_PX) * axis.bpPerPx,
  })
  const lanes = [
    offscreenLane(featureData.offscreenMates, 'query', q, {
      field: settings.field,
      namePosition: axisNamePosition(t),
      filter: config.filter,
      offsetPx: queryFrame.offsetPx,
      width: query.width,
      culled: culled.onQueryAxis,
      mateBand: bandOf(t, targetFrame.offsetPx),
    }),
    offscreenLane(featureData.targetOffscreenMates, 'target', t, {
      field: settings.field,
      namePosition: axisNamePosition(q),
      filter: config.filter,
      offsetPx: targetFrame.offsetPx,
      width: target.width,
      culled: featureData.targetQueried ? culled.onTargetAxis : undefined,
      mateBand: bandOf(q, queryFrame.offsetPx),
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
    ...comparativeLegend(settings, {
      filter: config.filter,
      cigarOps,
      trackName,
    }),
    config: { ...config, ...settings.config },
    alpha: level,
    assemblyNames: [q.assemblyName, t.assemblyName],
  }
}

export type SyntenyTables = Awaited<ReturnType<typeof syntenyTables>>
