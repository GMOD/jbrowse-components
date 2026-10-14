import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { abgrToHex, cssColorToHex } from '@jbrowse/core/util/colorBits'

import { scaleLaidOutData } from './LinearBasicDisplay/applyLayout.ts'
import { labelColors } from './LinearBasicDisplay/components/labelColors.ts'
import { forEachDisplayLabel } from './LinearBasicDisplay/components/labelPositioning.ts'
import { resolveMapColors } from './LinearBasicDisplay/components/resolveRegionColors.ts'
import configSchemaFactory from './LinearBasicDisplay/configSchema.ts'
import { featureColorKey } from './LinearBasicDisplay/derivedColorKey.ts'
import {
  fitLadderViews,
  fitLadderVolatiles,
} from './LinearBasicDisplay/fitLadderViews.ts'
import { resolvedGeneGlyphMode } from './LinearBasicDisplay/geneGlyphMode.ts'
import {
  ARROW_LENGTH_PX,
  STEM_HALF_H_PX,
} from './LinearBasicDisplay/passes/shaders/arrow.consts.generated.ts'
import {
  arrowDraws,
  arrowHeadHalfHeightPx,
} from './LinearBasicDisplay/passes/shaders/arrow.js.generated.ts'
import {
  CHEVRON_H_PX,
  CHEVRON_W_PX,
} from './LinearBasicDisplay/passes/shaders/chevron.consts.generated.ts'
import {
  chevronCount,
  chevronOffset,
  showChevrons,
} from './LinearBasicDisplay/passes/shaders/chevron.js.generated.ts'
import { isPlacedRow } from './LinearBasicDisplay/rowPlacement.ts'
import { labelVisibility } from './LinearBasicDisplay/showLabelsMode.ts'
import { executeRenderFeatureData } from './RenderFeatureDataRPC/executeRenderFeatureData.ts'
import { labelFontSize } from './RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { pickDisplayConfig } from './RenderFeatureDataRPC/renderConfig.ts'
import { featureColorViews } from './shared/featureColorViews.ts'

import type { LabelRenderContext } from './LinearBasicDisplay/components/labelPositioning.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
} from './RenderFeatureDataRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

interface TablesRegion {
  refName: string
  start: number
  end: number
  /** The contig's name in the reference, where the file spells it another way. */
  originalRefName?: string
}

export interface FeatureTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, for a CDS painted by reading frame. */
  sequenceAdapter?: Record<string, unknown>
  region?: TablesRegion
  /**
   * Several regions read as a view lays them end to end, such as a gene's
   * exons with the introns collapsed: one layout across all of them, as the
   * display packs every region of a contig together, so a feature crossing
   * regions keeps its row. Each table's rows name their region's index.
   */
  regions?: TablesRegion[]
  /**
   * The display's config as a track's `displays` entry writes it: `color`,
   * `displayMode`, `showLabels`, `geneGlyphMode`, `subfeatureLabels`,
   * `filter`, `showOnlyGenes`, `featureHeight` and the rest of a
   * `LinearBasicDisplay`'s slots. Unset draws the default display.
   */
  display?: Record<string, unknown>
  /**
   * The zoom the display lays out at, in bp per screen px: what decides
   * whether names fit beside features, which arrows and chevrons draw, and
   * how `auto` modes resolve.
   */
  bpPerPx: number
  /** Paint each CDS by its reading frame, as the view's "Color by CDS" does. */
  colorByCDS?: boolean
  /**
   * The most compressed bytes the region may need, refused off the index
   * before any feature is fetched. 200 MB by default.
   */
  byteLimit?: number
}

const DEFAULT_BYTE_LIMIT = 200_000_000

// The packer leaves a feature past its row ceiling at `OFFSCREEN_Y`, and a
// table row a million px up is no row: those features and their primitives
// leave every table. `row` maps a lane's feature index to its row in the
// `features` table, -1 for one left out.
function placedFeatures(d: FeatureDataResult) {
  const items: FlatbushItem[] = []
  const row: number[] = []
  for (const item of d.flatbushItems) {
    row.push(isPlacedRow(item.topPx) ? items.length : -1)
    if (isPlacedRow(item.topPx)) {
      items.push(item)
    }
  }
  return {
    items,
    truncated: d.flatbushItems.length - items.length,
    featureIndex: new Map(items.map((item, i) => [item.featureId, i])),
    keep: (featureIndices: Uint32Array) => {
      const keep: number[] = []
      for (let i = 0; i < featureIndices.length; i++) {
        if (row[featureIndices[i]!]! >= 0) {
          keep.push(i)
        }
      }
      return keep
    },
    feature: (laneFeatureIndex: number) => row[laneFeatureIndex]!,
  }
}

type PlacedFeatures = ReturnType<typeof placedFeatures>

function take<T>(lane: ArrayLike<T>, keep: readonly number[]) {
  return keep.map(i => lane[i]!)
}

/**
 * The intron lines' chevrons where the display draws them: each line wide
 * enough on screen gets `chevronCount` of them, spaced by `chevronOffset`,
 * pointing along its direction.
 */
function chevrons(
  d: FeatureDataResult,
  lines: readonly number[],
  rows: PlacedFeatures,
  bpPerPx: number,
) {
  const out = {
    position: [] as number[],
    y: [] as number[],
    direction: [] as number[],
    color: [] as string[],
    feature: [] as number[],
  }
  for (const i of lines) {
    const direction = d.lineDirections[i]!
    const start = d.linePositions[i * 2]!
    const widthPx = (d.linePositions[i * 2 + 1]! - start) / bpPerPx
    if (direction !== 0 && showChevrons(widthPx)) {
      const count = chevronCount(widthPx)
      for (let c = 0; c < count; c++) {
        out.position.push(start + chevronOffset(widthPx, count, c) * bpPerPx)
        out.y.push(d.lineYs[i]!)
        out.direction.push(direction)
        out.color.push(abgrToHex(d.lineColors[i]!))
        out.feature.push(rows.feature(d.lineFeatureIndices[i]!))
      }
    }
  }
  return out
}

/**
 * The strand arrows off feature ends where the display draws them: a feature
 * narrower on screen than `arrowDraws` allows gets none.
 */
function arrows(d: FeatureDataResult, rows: PlacedFeatures, bpPerPx: number) {
  const out = {
    position: [] as number[],
    y: [] as number[],
    direction: [] as number[],
    headHalfHeight: [] as number[],
    color: [] as string[],
    feature: [] as number[],
  }
  for (const i of rows.keep(d.arrowFeatureIndices)) {
    if (arrowDraws(d.arrowWidthsBp[i]! / bpPerPx, d.arrowGene[i] === 1)) {
      out.position.push(d.arrowXs[i]!)
      out.y.push(d.arrowYs[i]!)
      out.direction.push(d.arrowDirections[i]!)
      out.headHalfHeight.push(arrowHeadHalfHeightPx(d.arrowHeights[i]!))
      out.color.push(abgrToHex(d.arrowColors[i]!))
      out.feature.push(rows.feature(d.arrowFeatureIndices[i]!))
    }
  }
  return out
}

/**
 * #api
 * A region's features, or several regions', as the feature display
 * (`LinearBasicDisplay`) fetches, shapes, lays out and colors them, as
 * tables: each top-level feature on the
 * row the display's layout gives it, the boxes, intron lines, chevrons and
 * strand arrows its glyph draws, its transcripts, the labels the display
 * shows beside it at this zoom, and the color key, a ramp's as `ramps`
 * (`rampKeyOf`). For a host that draws them itself, such as R through V8. The
 * adapters must be registered on `pluginManager`.
 *
 * Coordinates are 0-based genomic; every `y`, `top` and height is in the
 * display's px, down from the track's top, `feature` is a 0-based index into
 * `features`, and `region` the index of the row's region. Regions of one
 * contig share one layout, as the display packs them, so a feature crossing
 * them is listed in each on the same row. The layout is the display's under
 * its `heightMode` and `height`: `fit` (the default) runs the display's fit
 * ladder, so the labels, isoforms and row heights the browser gives up to fit
 * the track are given up here too, and `grow` places every feature at full
 * size. A feature the packer could not place within its 10000 px row ceiling
 * is left out of every table and counted in `truncated`; the legend keys what
 * the worker painted, such a feature included, as the browser's key does.
 */
export async function featureTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    region,
    regions = region ? [region] : [],
    display = {},
    bpPerPx,
    colorByCDS = false,
    byteLimit = DEFAULT_BYTE_LIMIT,
  }: FeatureTablesArgs,
) {
  const conf = configSchemaFactory(pluginManager).create({
    ...display,
    type: 'LinearBasicDisplay',
    displayId: 'tables',
  })
  const displayMode = readConfObject(conf, 'displayMode')
  const collapsed = displayMode === 'collapsed'
  // Collapsed mode forces 'none' as the display does, since the label is baked
  // in the worker.
  const subfeatureLabels = collapsed
    ? 'none'
    : readConfObject(conf, 'subfeatureLabels')
  const raws = await Promise.all(
    regions.map(async r => {
      const result = await executeRenderFeatureData({
        pluginManager,
        args: {
          sessionId: 'tables',
          adapterConfig,
          sequenceAdapter,
          region: { assemblyName: '', ...r },
          displayConfig: {
            ...pickDisplayConfig(fullConfSnapshot(conf)),
            subfeatureLabels,
          },
          geneGlyphMode: resolvedGeneGlyphMode(
            readConfObject(conf, 'geneGlyphMode'),
            bpPerPx,
          ),
          bpPerPx,
          colorByCDS,
          showOnlyGenes: readConfObject(conf, 'showOnlyGenes'),
          byteLimit,
          statusCallback: () => {},
        } satisfies RpcExecuteArgs<'RenderFeatureData'>,
      })
      if ('regionTooLarge' in result) {
        throw new Error(
          `${r.refName}:${r.start}-${r.end} needs ${result.bytes} bytes of features, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
        )
      }
      return result.value
    }),
  )
  const items = raws.flatMap(raw => raw.flatbushItems)
  const widthsPx = regions.map(r => (r.end - r.start) / bpPerPx)
  const widthPx = widthsPx.reduce((a, b) => a + b, 0)
  const visibility = labelVisibility({
    mode: readConfObject(conf, 'showLabels'),
    collapsed,
    density: items.length / widthPx,
    geneDensity: () => {
      const genes = items.filter(item => item.gene).length
      return genes > 0 ? genes / widthPx : undefined
    },
    maxLabelDensity: readConfObject(conf, 'maxLabelFeatureDensity'),
    maxDescriptionDensity: readConfObject(conf, 'maxDescriptionFeatureDensity'),
  })
  const heightMode: string = readConfObject(conf, 'heightMode')
  const trackHeight: number = readConfObject(conf, 'height')
  const fontSize = labelFontSize(displayMode)
  // keyed by contig, as the display keys its regions, so the regions of one
  // contig pack as one group
  const rpcDataMap = new Map(
    raws.map((raw, i) => [i, { ...raw, regionKey: regions[i]!.refName }]),
  )
  const stage = fitLadderViews({
    ...fitLadderVolatiles(),
    rpcDataMap,
    layoutReady: true,
    layoutInputs: {
      bpPerPx,
      reversedRegions: new Set(),
      displayMode,
      pinnedFeatureIds: new Set(),
      expandedGeneIds: new Set(),
      facet: undefined,
      hiddenGroupKeys: new Set(),
      geneNamesOnly: visibility.geneNamesOnly,
    },
    showLabels: visibility.showLabels,
    effectiveShowDescriptions: visibility.showDescriptions,
    facet: undefined,
    fitMeasureFeatureIds:
      heightMode === 'grow'
        ? undefined
        : new Set(items.map(item => item.featureId)),
    fitHeightToDisplay: heightMode === 'fit',
    autoHeight: heightMode === 'grow',
    showsEveryIsoform: readConfObject(conf, 'geneGlyphMode') === 'all',
    reservesBelowLabelRows: subfeatureLabels === 'below',
    overlaysSubfeatureLabels: subfeatureLabels === 'overlay',
    fitTargetHeight: trackHeight,
    labelFontSize: fontSize,
  }).fitStage
  const laid =
    stage.scale === 1
      ? stage.layout
      : scaleLaidOutData(stage.layout, stage.scale)
  const palette = resolvePalette()
  const colors = featureColorViews({
    conf: { color: conf.color },
    rpcDataMap: new Map(raws.map((raw, i) => [i, raw])),
  })
  const resolved = resolveMapColors(laid, palette, colors.fieldPalette)
  const scales = featureColorKey(colors, raws)
  const key = scales.find(scale => scale.kind === 'categorical')
  const entries = key?.entries.filter(e => e.color !== undefined) ?? []
  const hideChevrons = !readConfObject(conf, 'displayDirectionalChevrons')
  const labels = {
    showLabels: stage.showLabels,
    showDescriptions: stage.showDescriptions,
    showSubfeatureLabels: stage.scale === 1 && !stage.dropBelowLabelRows,
    fontSize: stage.dropBelowLabelRows ? 0 : fontSize,
    colors: labelColors(palette),
  }
  return {
    ...joinRegionTables(
      regions.map((r, i) =>
        laidOutTables(resolved.get(i)!, {
          region: r,
          widthPx: widthsPx[i]!,
          bpPerPx,
          hideChevrons,
          labels,
        }),
      ),
    ),
    legend: {
      label: entries.map(e => e.label),
      color: entries.map(e => cssColorToHex(e.color!)),
    },
    legendTitle: key?.title ?? '',
    ramps: scales.filter(scale => scale.kind === 'ramp').map(rampKeyOf),
    /** The px sizes the display draws its fixed-size marks at. */
    glyph: {
      fontSize,
      arrowLength: ARROW_LENGTH_PX,
      arrowStemHalfHeight: STEM_HALF_H_PX,
      chevronWidth: CHEVRON_W_PX,
      chevronHeight: CHEVRON_H_PX,
    },
    bpPerPx,
  }
}

/**
 * One laid-out region as tables, every `feature` column an index into
 * `features`: the features the packer placed, their boxes, lines, chevrons,
 * arrows and transcripts, and the labels `labels` says render. Pure in `d`,
 * so a test stands a region up without an adapter.
 */
export function laidOutTables(
  d: FeatureDataResult,
  {
    region,
    widthPx,
    bpPerPx,
    hideChevrons,
    labels: labelContext,
  }: {
    region: { start: number; end: number }
    widthPx: number
    bpPerPx: number
    hideChevrons: boolean
    labels: LabelRenderContext
  },
) {
  const rows = placedFeatures(d)
  const { items, featureIndex } = rows
  const subfeatures = d.subfeatureInfos.filter(s =>
    featureIndex.has(s.parentFeatureId),
  )
  const subfeatureIndex = new Map(subfeatures.map((s, i) => [s.featureId, i]))
  const labels = {
    text: [] as string[],
    kind: [] as string[],
    position: [] as number[],
    y: [] as number[],
    color: [] as string[],
    feature: [] as number[],
    subfeature: [] as number[],
  }
  forEachDisplayLabel(
    [
      {
        start: region.start,
        end: region.end,
        screenStartPx: 0,
        screenEndPx: widthPx,
        displayedRegionIndex: 0,
      },
    ],
    new Map([[0, d]]),
    labelContext,
    (featureId, placed) => {
      for (const p of placed) {
        if (p.kind !== 'more') {
          labels.text.push(p.label.text)
          labels.kind.push(p.kind === 'desc' ? 'description' : p.kind)
          labels.position.push(region.start + p.labelX * bpPerPx)
          labels.y.push(p.labelY)
          labels.color.push(cssColorToHex(p.color))
          const sub = subfeatureIndex.get(featureId)
          labels.subfeature.push(sub ?? -1)
          labels.feature.push(
            featureIndex.get(
              sub === undefined ? featureId : subfeatures[sub]!.parentFeatureId,
            )!,
          )
        }
      }
    },
  )

  const rects = rows.keep(d.rectFeatureIndices)
  const lines = rows.keep(d.lineFeatureIndices)
  return {
    features: {
      id: items.map(item => item.featureId),
      name: items.map(item => item.name ?? ''),
      type: items.map(item => item.type ?? ''),
      start: items.map(item => item.startBp),
      end: items.map(item => item.endBp),
      strand: items.map(item => item.strand ?? 0),
      top: items.map(item => item.topPx),
      bottom: items.map(item => item.bottomPx),
      gene: items.map(item => !!item.gene),
    },
    subfeatures: {
      id: subfeatures.map(s => s.featureId),
      name: subfeatures.map(s => s.displayLabel ?? ''),
      type: subfeatures.map(s => s.type ?? ''),
      start: subfeatures.map(s => s.startBp),
      end: subfeatures.map(s => s.endBp),
      top: subfeatures.map(s => s.topPx),
      bottom: subfeatures.map(s => s.bottomPx),
      feature: subfeatures.map(s => featureIndex.get(s.parentFeatureId)!),
    },
    rects: {
      start: rects.map(i => d.rectPositions[i * 2]!),
      end: rects.map(i => d.rectPositions[i * 2 + 1]!),
      top: take(d.rectYs, rects),
      height: take(d.rectHeights, rects),
      color: take(d.rectColors, rects).map(abgrToHex),
      feature: take(d.rectFeatureIndices, rects).map(rows.feature),
    },
    lines: {
      start: lines.map(i => d.linePositions[i * 2]!),
      end: lines.map(i => d.linePositions[i * 2 + 1]!),
      y: take(d.lineYs, lines),
      color: take(d.lineColors, lines).map(abgrToHex),
      feature: take(d.lineFeatureIndices, lines).map(rows.feature),
    },
    chevrons: chevrons(d, hideChevrons ? [] : lines, rows, bpPerPx),
    arrows: arrows(d, rows, bpPerPx),
    labels,
    height: items.reduce((max, item) => Math.max(max, item.bottomPx), 0),
    /** Features the packer could not place, which no table lists. */
    truncated: rows.truncated,
  }
}

type RegionTables = ReturnType<typeof laidOutTables>
const TABLES = [
  'features',
  'subfeatures',
  'rects',
  'lines',
  'chevrons',
  'arrows',
  'labels',
] as const

/**
 * Each region's tables as one set: every row names its region's index, and
 * every `feature` and `subfeature` index points into the joined `features`
 * and `subfeatures`. A feature crossing regions is listed in each.
 */
function joinRegionTables(parts: RegionTables[]) {
  let features = 0
  let subfeatures = 0
  const joined = parts.map((part, region) => {
    const out = Object.fromEntries(
      TABLES.map(name => {
        const table: Record<string, unknown[]> = { ...part[name] }
        const n = Object.values(table)[0]?.length ?? 0
        if (table.feature) {
          table.feature = table.feature.map(f => (f as number) + features)
        }
        if (name === 'labels') {
          table.subfeature = table.subfeature!.map(s =>
            (s as number) < 0 ? s : (s as number) + subfeatures,
          )
        }
        table.region = new Array(n).fill(region)
        return [name, table]
      }),
    )
    features += part.features.id.length
    subfeatures += part.subfeatures.id.length
    return out
  })
  const tables = Object.fromEntries(
    TABLES.map(name => {
      const columns = Object.keys(joined[0]?.[name] ?? {})
      return [
        name,
        Object.fromEntries(
          columns.map(c => [c, joined.flatMap(part => part[name]![c]!)]),
        ),
      ]
    }),
  ) as {
    [K in (typeof TABLES)[number]]: RegionTables[K] & { region: number[] }
  }
  return {
    ...tables,
    height: Math.max(0, ...parts.map(part => part.height)),
    truncated: parts.reduce((sum, part) => sum + part.truncated, 0),
  }
}

export type FeatureTables = Awaited<ReturnType<typeof featureTables>>
