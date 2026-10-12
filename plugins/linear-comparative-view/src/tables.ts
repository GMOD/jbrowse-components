import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'
import {
  FADE_AUTO_MIN_FEATURES,
  attributeColumns,
  axisNamePosition,
  bandGroundColor,
  cappedMeanWidthPx,
  comparativeAxis,
  comparativeLegend,
  createComparativeColorFunction,
  fadesThinAt,
  isInstanceInvisible,
  locateCum,
  unpack,
  viewColorSettings,
} from '@jbrowse/synteny-core'

import {
  MIN_CONTIG_MARK_PX,
  MIN_OFFSCREEN_MATE_WIDTH_PX,
  offscreenMateColors,
  offscreenMateMarkHeight,
} from './LinearSyntenyDisplay/drawOffscreenMates.ts'
import { thinWidthFade } from './LinearSyntenyDisplay/shaders/syntenyTypes.js.generated.ts'
import { computeSyntenyColors } from './LinearSyntenyDisplay/syntenyColors.ts'
import {
  ribbonMaxPerpWidth,
  ribbonPerpWidth,
} from './LinearSyntenyDisplay/syntenyRibbonPath.ts'
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

import type { OffscreenMateData } from './LinearSyntenyRPC/collectOffscreenMates.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AxisArgs,
  ColorArg,
  ComparativeAxis,
  OpacityArg,
  RefNamePosition,
} from '@jbrowse/synteny-core'

export { registerComparativeAdapters }

export interface SyntenyTablesArgs {
  adapterConfig: Record<string, unknown>
  /** the upper row, the adapter's query side unless it names an assembly */
  query: AxisArgs
  /** the lower row, the adapter's target side unless it names an assembly */
  target: AxisArgs
  /**
   * The view's settings, as a `LinearSyntenyView` snapshot writes them:
   * `color` (a CSS color, or the color object's slots such as
   * `{ field: 'strand' }`), `opacity` (a number, or the opacity object),
   * `minAlignmentLength`, `cigarMode` (`full`, `matches` or `off`),
   * `drawLocationMarkers`, `fadeThinAlignmentsMode` (`auto`, `on`, `off`) and
   * the level's `height` in px, which the thin-ribbon fade measures against.
   */
  view?: {
    color?: ColorArg
    opacity?: OpacityArg
    minAlignmentLength?: number
    cigarMode?: 'full' | 'matches' | 'off'
    drawLocationMarkers?: boolean
    fadeThinAlignmentsMode?: 'auto' | 'on' | 'off'
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
  // the contig color the strip paints a mark in, or the band's grey
  colorOf: (refName: string) => { color: string; alpha: number }
  minAlignmentLength: number
}

// The lane the display hangs off a row's edge: its marks and their color are
// `offscreenMateMarkColorFor`'s, which names a contig in its ribbons' color
// only when the ribbons are keyed by the axis the mate is on
function offscreenLane(
  data: OffscreenMateData,
  axis: 'query' | 'target',
  on: ComparativeAxis,
  {
    field,
    namePosition,
    minAlignmentLength,
  }: {
    field: string
    namePosition?: RefNamePosition
    minAlignmentLength: number
  },
): OffscreenLane {
  const keyed = offscreenMateMarkColorFor(
    [{ paintedField: field, paintedRefNamePosition: namePosition }],
    axis === 'query' ? 'top' : 'bottom',
  )
  const grey = offscreenMateColors(bandGroundColor()).markColor
  return {
    data,
    axis,
    on,
    colorOf: refName => unpack(cssColorToABGR(keyed?.(refName) ?? grey)),
    minAlignmentLength,
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
// it: the alignments to it and the sequence they cover
function offscreenContigRows({ data, axis, colorOf }: OffscreenLane) {
  const paint = data.mateRefNameDict.map(colorOf)
  return {
    axis: data.mateRefNameDict.map(() => axis),
    mateChrom: [...data.mateRefNameDict],
    count: Array.from(data.counts),
    alignedBp: Array.from(data.alignedBp),
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
 * color the view's `color` paints it; `ribbons`, what the band draws between
 * the rows in paint order, each a trapezoid from a span on the query row to
 * a span on the target row (`match` for the block, `insertion`, `deletion`
 * and `skip` for the CIGAR ops wide enough to draw, `marker` for a location
 * tick), with its color and the alpha it composites at, and whether it draws
 * as a centerline; `offscreen`, the blocks whose mate lies on a contig the
 * other row is not showing, in the color the strip along that row's edge
 * paints them, `offscreenContigs`, the count and aligned bp of each such
 * contig, and `offscreenStrip`, the strip's pixel height and narrowest mark;
 * and `legend` and `ramps`, the key. For a host that draws
 * them itself, such as R through V8. Positions are genomic, on the axis's
 * region named by `queryRegion` and `targetRegion`.
 */
export async function syntenyTables(
  pluginManager: PluginManager,
  { adapterConfig, query, target, view = {} }: SyntenyTablesArgs,
) {
  const q = comparativeAxis(query, adapterConfig, 0)
  const t = comparativeAxis(target, adapterConfig, 1)
  const cigarMode = view.cigarMode ?? 'full'
  const height = view.height ?? DEFAULT_LEVEL_HEIGHT
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
    drawCIGAR: cigarMode !== 'off',
    drawCIGARMatchesOnly: cigarMode === 'matches',
    statusCallback: () => {},
  })
  const { instanceData, ...featureData } = value
  const settings = viewColorSettings({
    color: view.color,
    opacity: view.opacity,
    defaultOpacity: DEFAULT_ALPHA,
    attributeRanges: featureData.attributeRanges,
  })
  const namePosition =
    settings.field === 'query'
      ? axisNamePosition(q)
      : settings.field === 'target'
        ? axisNamePosition(t)
        : undefined
  const colorArgs = {
    field: settings.field,
    trackColor: settings.trackColor,
    namePosition,
    attributeRanges: settings.attributeRanges,
    paint: settings.paint,
    opacity: settings.fade,
  }
  const colors = computeSyntenyColors({
    instanceData,
    featureData,
    ...colorArgs,
    valueColor: settings.valueColor,
    drawLocationMarkers: view.drawLocationMarkers ?? false,
    groundColor: bandGroundColor(),
  })
  const featureColor = createComparativeColorFunction({
    ...colorArgs,
    data: featureData,
    defaultColor: cssColorToABGR(settings.valueColor ?? '#f00'),
  })

  const n = featureData.featureIds.length
  const minLength = view.minAlignmentLength ?? 0
  const mode = view.fadeThinAlignmentsMode ?? 'auto'
  const fadeThin =
    mode === 'auto'
      ? fadesThinAt(
          n >= FADE_AUTO_MIN_FEATURES
            ? cappedMeanWidthPx(featureData.starts, featureData.ends, q.bpPerPx)
            : Infinity,
          false,
        )
      : mode === 'on'
  const level = settings.level

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
    if (instanceData.alignmentLengths[i]! < minLength) {
      continue
    }
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
    const thin = marker || ribbonMaxPerpWidth(corners, height, false) < 1
    const { color, alpha } = unpack(packed)
    const fade = marker
      ? 1
      : thin
        ? level *
          thinWidthFade(ribbonPerpWidth(corners, height), kind, fadeThin)
        : level
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
    ribbons.alpha.push(alpha * fade)
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
    offscreenStrip: {
      height: offscreenMateMarkHeight(height),
      minWidth: MIN_OFFSCREEN_MATE_WIDTH_PX,
    },
    ...comparativeLegend(settings, { cigarOps }),
    field: settings.field,
    alpha: level,
    fadeThin,
    height,
    assemblyNames: [q.assemblyName, t.assemblyName],
    hasCigar: featureData.hasCigar,
  }
}

export type SyntenyTables = Awaited<ReturnType<typeof syntenyTables>>
