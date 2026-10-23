import { CIGAR_D, CIGAR_I, CIGAR_N } from '@jbrowse/cigar-utils'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { lowerBoundOf } from '@jbrowse/core/util/fieldPredicate'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'
import {
  attributeColumns,
  axisNamePosition,
  comparativeAxis,
  comparativeLegend,
  createComparativeColorFunction,
  isInstanceInvisible,
  locateCum,
  resolvedIndels,
  unpack,
  viewColorSettings,
} from '@jbrowse/synteny-core'

import { computeDotplotColors } from './DotplotDisplay/dotplotColors.ts'
import { buildLineSegments } from './DotplotDisplay/dotplotGeometry.ts'
import { executeDotplotFeaturesAndPositions } from './DotplotDisplay/executeDotplotFeaturesAndPositions.ts'
import { DEFAULT_ALPHA, DEFAULT_LINE_WIDTH } from './DotplotView/consts.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AxisArgs,
  ColorArg,
  ComparativeAxis,
  FilterArg,
  IndelsArg,
  OpacityArg,
} from '@jbrowse/synteny-core'

export { registerComparativeAdapters }

export interface DotplotTablesArgs {
  adapterConfig: Record<string, unknown>
  /** the horizontal axis, the adapter's query side unless it names an assembly */
  x: AxisArgs
  /** the vertical axis, the adapter's target side unless it names an assembly */
  y: AxisArgs
  /**
   * The view's settings, as a `DotplotView` snapshot writes them:
   * `encoding` (`color`, a field such as `'strand'` or the color channel's
   * slots, and `opacity`, a number or the opacity channel), `filter` (a list
   * of field predicates), `indels` (`show`, and `encoding.opacity` 0 to leave
   * each indel a gap) and `lineWidth`.
   */
  view?: {
    encoding?: { color?: ColorArg; opacity?: OpacityArg }
    filter?: FilterArg
    indels?: IndelsArg
    lineWidth?: number
  }
}

const OP_NAMES: Record<number, string> = {
  [CIGAR_I]: 'insertion',
  [CIGAR_D]: 'deletion',
  [CIGAR_N]: 'skip',
}

/**
 * #api
 * A dotplot as the display fetches, lays out and colors it, as tables:
 * `alignments`, each block with its span on each axis, its strand, name and
 * measurements, in the color the view's `encoding.color` paints it; `segments`, the
 * lines the plot draws in paint order, one per block, or one per CIGAR step
 * where a block is wide enough on screen for its CIGAR to show, each from
 * (`xStart`, `yStart`) to (`xEnd`, `yEnd`) in genomic coordinates on the
 * axis's region named by `xRegion` and `yRegion`; `legend`, the key; and
 * `config`, the view's settings with their defaults filled, `encoding.color` and
 * `encoding.opacity` as config objects.
 * `skipped` counts the blocks neither axis places. For a host that draws
 * them itself, such as R through V8.
 */
export async function dotplotTables(
  pluginManager: PluginManager,
  { adapterConfig, x, y, view = {} }: DotplotTablesArgs,
) {
  const indels = resolvedIndels(view.indels)
  const config = {
    filter: view.filter ?? [],
    indels: indels.settings,
    lineWidth: view.lineWidth ?? DEFAULT_LINE_WIDTH,
  }
  const h = comparativeAxis(x, adapterConfig, 0)
  const v = comparativeAxis(y, adapterConfig, 1)
  const { value } = await executeDotplotFeaturesAndPositions({
    pluginManager,
    sessionId: 'tables',
    adapterConfig,
    regions: h.regions,
    hViewSnap: { bpPerPx: h.bpPerPx, displayedRegions: h.regions },
    vViewSnap: { bpPerPx: v.bpPerPx, displayedRegions: v.regions },
    statusCallback: () => {},
  })
  const { skippedHRefNames, skippedVRefNames, ...rpcData } = value
  const settings = viewColorSettings({
    color: view.encoding?.color,
    opacity: view.encoding?.opacity,
    defaultOpacity: DEFAULT_ALPHA,
    attributeRanges: rpcData.attributeRanges,
  })
  const namePosition =
    settings.field === 'query'
      ? axisNamePosition(h)
      : settings.field === 'target'
        ? axisNamePosition(v)
        : undefined
  const instanceData = buildLineSegments(
    rpcData,
    indels.drawing !== 'off',
    lowerBoundOf(config.filter, 'length') ?? 0,
    h.bpPerPx,
    v.bpPerPx,
    0,
    0,
    indels.drawing === 'matches',
  )
  const colorArgs = {
    field: settings.field,
    trackColor: settings.trackColor,
    namePosition,
    attributeRanges: settings.attributeRanges,
    paint: settings.paint,
    opacity: settings.fade,
  }
  const filterExtras = { lengthOf: (i: number) => rpcData.alignmentLengths[i]! }
  const colors = computeDotplotColors({
    instanceData,
    rpcData,
    ...colorArgs,
    filter: { predicates: config.filter, extras: filterExtras },
    valueColor: settings.valueColor,
  })
  const featureColor = createComparativeColorFunction({
    ...colorArgs,
    data: rpcData,
    defaultColor: cssColorToABGR(settings.valueColor ?? '#000'),
    filter: config.filter,
    filterExtras,
  })
  const level = settings.level

  const named = (dict: readonly string[], ids: ArrayLike<number>) =>
    Array.from(ids, id => dict[id]!)
  const n = rpcData.p11.length
  const alignments = {
    name: named(rpcData.nameDict, rpcData.nameIds),
    xChrom: named(rpcData.refNameDict, rpcData.refNameIds),
    xStart: [] as number[],
    xEnd: [] as number[],
    yChrom: named(rpcData.mateRefNameDict, rpcData.mateRefNameIds),
    yStart: [] as number[],
    yEnd: [] as number[],
    strand: Array.from(rpcData.strands),
    length: Array.from(rpcData.alignmentLengths),
    ...attributeColumns(rpcData.attributes, rpcData.attributeRanges),
    color: [] as string[],
    alpha: [] as number[],
  }
  const span = (axis: ComparativeAxis, a: number, b: number) => {
    const lo = locateCum(axis, Math.min(a, b), Math.max(a, b)).coord
    const hi = locateCum(axis, Math.max(a, b), Math.min(a, b)).coord
    return [Math.min(lo, hi), Math.max(lo, hi)]
  }
  for (let i = 0; i < n; i++) {
    const [xs, xe] = span(h, rpcData.p11[i]!, rpcData.p12[i]!)
    const [ys, ye] = span(v, rpcData.p21[i]!, rpcData.p22[i]!)
    alignments.xStart.push(xs!)
    alignments.xEnd.push(xe!)
    alignments.yStart.push(ys!)
    alignments.yEnd.push(ye!)
    const { color, alpha } = unpack(featureColor(i))
    alignments.color.push(color)
    alignments.alpha.push(alpha * level)
  }

  const segments = {
    alignment: [] as number[],
    op: [] as string[],
    xRegion: [] as number[],
    xChrom: [] as string[],
    xStart: [] as number[],
    xEnd: [] as number[],
    yRegion: [] as number[],
    yChrom: [] as string[],
    yStart: [] as number[],
    yEnd: [] as number[],
    color: [] as string[],
    alpha: [] as number[],
  }
  for (let i = 0; i < instanceData.instanceCount; i++) {
    const packed = colors[i]!
    if (isInstanceInvisible(packed, level)) {
      continue
    }
    const x1 = instanceData.x1[i]!
    const x2 = instanceData.x2[i]!
    const y1 = instanceData.y1[i]!
    const y2 = instanceData.y2[i]!
    const xa = locateCum(h, x1, x2)
    const xb = locateCum(h, x2, x1)
    const ya = locateCum(v, y1, y2)
    const yb = locateCum(v, y2, y1)
    const { color, alpha } = unpack(packed)
    segments.alignment.push(instanceData.instanceFeatureIdx[i]!)
    segments.op.push(OP_NAMES[instanceData.segmentOps[i]!] ?? 'match')
    segments.xRegion.push(xa.region)
    segments.xChrom.push(h.regions[xa.region]!.refName)
    segments.xStart.push(xa.coord)
    segments.xEnd.push(xb.coord)
    segments.yRegion.push(ya.region)
    segments.yChrom.push(v.regions[ya.region]!.refName)
    segments.yStart.push(ya.coord)
    segments.yEnd.push(yb.coord)
    segments.color.push(color)
    segments.alpha.push(alpha * level)
  }

  return {
    alignments,
    segments,
    ...comparativeLegend(settings, { pointBased: true }),
    config: { ...config, ...settings.config },
    field: settings.field,
    alpha: level,
    assemblyNames: [h.assemblyName, v.assemblyName],
    skipped: {
      count: rpcData.skippedFeatureCount,
      total: rpcData.totalFeatureCount,
      xChroms: skippedHRefNames,
      yChroms: skippedVRefNames,
    },
  }
}

export type DotplotTables = Awaited<ReturnType<typeof dotplotTables>>
