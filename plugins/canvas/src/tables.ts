import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
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

import type { FeatureDataResult } from './RenderFeatureDataRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export interface FeatureTablesArgs {
  adapterConfig: Record<string, unknown>
  /** The assembly's sequence adapter, for a CDS painted by reading frame. */
  sequenceAdapter?: Record<string, unknown>
  region: {
    refName: string
    start: number
    end: number
    /** The contig's name in the reference, where the file spells it another way. */
    originalRefName?: string
  }
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

// A primitive's row in the output tables, where it belongs to a placed
// feature: the packer leaves a feature past its row ceiling at `OFFSCREEN_Y`,
// and a table row a million px up is no row.
interface PlacedRows {
  // Indices into the lane arrays whose owner the layout placed.
  keep: (featureIndices: Uint32Array) => number[]
  // A lane's feature index to its row in the `features` table.
  feature: (laneFeatureIndex: number) => number
}

function placedRows(d: FeatureDataResult): PlacedRows {
  const row: number[] = []
  let next = 0
  for (const item of d.flatbushItems) {
    row.push(isPlacedRow(item.topPx) ? next++ : -1)
  }
  return {
    keep: featureIndices => {
      const keep: number[] = []
      for (let i = 0; i < featureIndices.length; i++) {
        if (row[featureIndices[i]!]! >= 0) {
          keep.push(i)
        }
      }
      return keep
    },
    feature: i => row[i]!,
  }
}

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
  rows: PlacedRows,
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
function arrows(d: FeatureDataResult, rows: PlacedRows, bpPerPx: number) {
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
 * A region's features as the feature display (`LinearBasicDisplay`) fetches,
 * shapes, lays out and colors them, as tables: each top-level feature on the
 * row the display's layout gives it, the boxes, intron lines, chevrons and
 * strand arrows its glyph draws, its transcripts, the labels the display
 * shows beside it at this zoom, and the color key. For a host that draws them
 * itself, such as R through V8. The adapters must be registered on
 * `pluginManager`.
 *
 * Coordinates are 0-based genomic; every `y`, `top` and height is in the
 * display's px, down from the track's top, and `feature` is a 0-based index
 * into `features`. The layout is the display's under its `heightMode` and
 * `height`: `fit` (the default) runs the display's fit ladder, so the labels,
 * isoforms and row heights the browser gives up to fit the track are given up
 * here too, and `grow` places every feature at full size.
 */
export async function featureTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    sequenceAdapter,
    region,
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
  const args: RpcExecuteArgs<'RenderFeatureData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    region: { assemblyName: '', ...region },
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
  }
  const result = await executeRenderFeatureData({ pluginManager, args })
  const where = `${region.refName}:${region.start}-${region.end}`
  if ('regionTooLarge' in result) {
    throw new Error(
      `${where} needs ${result.bytes} bytes of features, over the ${byteLimit}-byte limit; read a smaller region or raise byteLimit`,
    )
  }
  const raw = result.value
  const widthPx = (region.end - region.start) / bpPerPx
  const visibility = labelVisibility({
    mode: readConfObject(conf, 'showLabels'),
    collapsed,
    density: raw.flatbushItems.length / widthPx,
    geneDensity: () => {
      const genes = raw.flatbushItems.filter(item => item.gene).length
      return genes > 0 ? genes / widthPx : undefined
    },
    maxLabelDensity: readConfObject(conf, 'maxLabelFeatureDensity'),
    maxDescriptionDensity: readConfObject(conf, 'maxDescriptionFeatureDensity'),
  })
  const heightMode: string = readConfObject(conf, 'heightMode')
  const trackHeight: number = readConfObject(conf, 'height')
  const fontSize = labelFontSize(displayMode)
  const rpcDataMap = new Map([[0, { ...raw, regionKey: region.refName }]])
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
        : new Set(raw.flatbushItems.map(item => item.featureId)),
    fitHeightToDisplay: heightMode === 'fit',
    autoHeight: heightMode === 'grow',
    showsEveryIsoform: readConfObject(conf, 'geneGlyphMode') === 'all',
    reservesBelowLabelRows: subfeatureLabels === 'below',
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
    rpcDataMap: new Map([[0, raw]]),
  })
  const d = resolveMapColors(laid, palette, colors.fieldPalette).get(0)!
  const labels = {
    text: [] as string[],
    kind: [] as string[],
    position: [] as number[],
    y: [] as number[],
    color: [] as string[],
    feature: [] as number[],
    subfeature: [] as number[],
  }
  const rows = placedRows(d)
  const items = d.flatbushItems.filter(item => isPlacedRow(item.topPx))
  const featureIndex = new Map(items.map((item, i) => [item.featureId, i]))
  const subfeatures = d.subfeatureInfos.filter(s =>
    featureIndex.has(s.parentFeatureId),
  )
  const subfeatureIndex = new Map(subfeatures.map((s, i) => [s.featureId, i]))
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
    {
      showLabels: stage.showLabels,
      showDescriptions: stage.showDescriptions,
      showSubfeatureLabels: stage.scale === 1 && !stage.dropBelowLabelRows,
      fontSize: stage.dropBelowLabelRows ? 0 : fontSize,
      colors: labelColors(palette),
    },
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
            ) ?? -1,
          )
        }
      }
    },
  )

  const rects = rows.keep(d.rectFeatureIndices)
  const lines = rows.keep(d.lineFeatureIndices)
  const hideChevrons = !readConfObject(conf, 'displayDirectionalChevrons')
  const key = featureColorKey(colors, [raw]).find(
    scale => scale.kind === 'categorical',
  )
  const entries = key?.entries.filter(e => e.color !== undefined) ?? []
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
    legend: {
      label: entries.map(e => e.label),
      color: entries.map(e => cssColorToHex(e.color!)),
    },
    legendTitle: key?.title ?? '',
    /** The px sizes the display draws its fixed-size marks at. */
    glyph: {
      fontSize,
      arrowLength: ARROW_LENGTH_PX,
      arrowStemHalfHeight: STEM_HALF_H_PX,
      chevronWidth: CHEVRON_W_PX,
      chevronHeight: CHEVRON_H_PX,
    },
    height: items.reduce((max, item) => Math.max(max, item.bottomPx), 0),
    bpPerPx,
  }
}

export type FeatureTables = Awaited<ReturnType<typeof featureTables>>
