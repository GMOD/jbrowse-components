import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import {
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import { windowFetchRegions } from '@jbrowse/display-kit/regionHost'
import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'
import { thresholdBandOf } from '@jbrowse/render-core/marks'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { clipSide } from '@jbrowse/render-core/shaders/clipStrip'
import {
  CLIP_STRIP_COLOR,
  CLIP_STRIP_PX,
} from '@jbrowse/render-core/shaders/clipStripConsts'
import { columnSegments } from '@jbrowse/tree-sidebar/binColumns'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_XYPLOT,
  resolveRenderState,
  resolveSymlogConstant,
} from '@jbrowse/wiggle-core'
import { runInAction } from 'mobx'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import MultiWiggleAdapterF from './MultiWiggleAdapter/index.ts'
import { executeRenderMultiWiggleData } from './RenderMultiWiggleDataRPC/executeRenderMultiWiggleData.ts'
import { getScoreMatrix } from './WiggleRPC/getScoreMatrix.ts'
import { matrixScale } from './WiggleRPC/matrixScale.ts'
import { buildSourceRenderData } from './shared/buildSourceRenderData.ts'
import { scoreRampFill } from './shared/scoreRampScale.ts'
import { WHISKER_BAND_OPACITY } from './shared/shaders/wiggleBand.consts.generated.ts'
import {
  createWiggleStaticHost,
  wiggleTrackTypeOf,
} from './shared/wiggleStaticHost.ts'

import type { WiggleTrackType } from './shared/wiggleStaticHost.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

/** Registers the adapters `wiggleTables` reads through, BigWig and multi-wiggle. */
export function registerWiggleAdapters(pluginManager: PluginManager) {
  BigWigAdapterF(pluginManager)
  MultiWiggleAdapterF(pluginManager)
}

export interface WiggleTablesArgs {
  adapterConfig: Record<string, unknown>
  /**
   * The regions read as a view lays them end to end: one score domain and
   * one color ramp across all of them, as the display autoscales to every
   * region it shows. Each mark and bin names its region's index.
   */
  regions: TablesRegion[]
  /**
   * The regions the view displays, which `regions` are windows into: one
   * locus's whole contig, as the browser shows a locus. The display fetches
   * and scales over each window and the view's margin around it, clamped to the
   * region displayed, and the tables list what the windows show. Unset,
   * `regions` themselves.
   */
  displayedRegions?: TablesRegion[]
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearWiggleDisplay`: `mark`, `origin`, `encoding`, `rows`,
   * `data` and the rest of its slots. Unset reads the default display.
   */
  display?: Record<string, unknown>
  /**
   * The zoom the display draws at, in bp per screen px: what decides which
   * of a BigWig's zoom levels answers, and so how wide each bin is.
   */
  bpPerPx: number
  /**
   * The track type whose display defaults `display` fills from: a
   * `MultiQuantitativeTrack` defaults to a row per source and no min-max
   * extent. Unset, a `MultiWiggleAdapter` reads as one.
   */
  trackType?: WiggleTrackType
}

/** Whether the bin of `positions`, start and end pairs, at `i` overlaps `region`. */
function binInWindow({ start, end }: { start: number; end: number }) {
  return (positions: ArrayLike<number>, i: number) =>
    positions[i * 2 + 1]! > start && positions[i * 2]! < end
}

/**
 * The display's static host over the scores it fetched for `regions` at
 * `bpPerPx`, and the fetch's result for each region.
 */
async function fetchedWiggleHost(
  pluginManager: PluginManager,
  {
    adapterConfig,
    regions,
    displayedRegions,
    display = {},
    bpPerPx,
    trackType = wiggleTrackTypeOf(adapterConfig),
  }: WiggleTablesArgs,
) {
  const model = createWiggleStaticHost({ trackType, id: 'tables', display })
  const fetchInputs = runInAction(() => ({
    resolution: model.resolution,
    yField: model.yField,
  }))
  const args: RpcExecuteArgs<'RenderMultiWiggleData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: windowFetchRegions(regions, displayedRegions).map(r => ({
      assemblyName: '',
      ...r,
    })),
    bpPerPx,
    ...fetchInputs,
    statusCallback: () => {},
  }
  if (args.regions.length === 0) {
    throw new Error('wiggleTables needs a region or regions')
  }
  const results = (await executeRenderMultiWiggleData({ pluginManager, args }))
    .value
  model.setFetched(
    {
      initialized: true,
      settledDynamicBlocks: regions.map((r, i) => ({
        start: r.start,
        end: r.end,
        displayedRegionIndex: i,
      })),
      trackWidthPx: regions.reduce(
        (sum, r) => sum + (r.end - r.start) / bpPerPx,
        0,
      ),
    },
    new Map(results.entries()),
  )
  return { model, results }
}

/**
 * #api
 * A region, or several, of a quantitative track as the wiggle display
 * fetches, scales and colors it, as tables: `bins`, each source's scores as
 * the worker ships them at this zoom (the bin's score, and its min and max
 * where the file summarizes); `summaryField`, which of them the display plots
 * (`score`, `minScore` or `maxScore`); `marks`, the layers the display's
 * encoder builds from them in paint order (the plotted summary, and under a
 * min-max extent the tinted max and min bands, or a line's min-to-max
 * `band`), each mark in the color it paints and reaching down to `low`, the
 * band's min or the origin bars grow from, and on a bar `clipSide`, 1 where
 * its score passes the domain's top and -1 its bottom, where the display
 * paints `clipStrip` (its `color`, `px` tall) across the row's edge, else 0;
 * `scoreScale`, the score axis the
 * display autoscales to under `encoding.y`, its `domain`, `type` and
 * `symlogConstant`; `rules`, the reference lines it draws, none where it
 * rules no band, as a density plot does not; `ramps`, the color bar its key
 * shows where one ramp paints every row (`rampKeyOf`); `legend` and
 * `legendTitle`, the categorical key beside it (`colorKeyTables`): the
 * threshold bands and the row color key, the subtracks of an overlay or a
 * `rows.color` field's values; and `warnings`, the samples file's. For a host that draws them itself, such as
 * R through V8. The adapters must be registered on `pluginManager`
 * (`registerWiggleAdapters`).
 */
export async function wiggleTables(
  pluginManager: PluginManager,
  args: WiggleTablesArgs,
) {
  const { regions } = args
  const { model, results } = await fetchedWiggleHost(pluginManager, args)
  const conf = model.configuration
  const data = results[0]!

  const {
    sources,
    markSources,
    wiggleColor,
    scoreRamp,
    gpuProps,
    domain,
    scaleType,
    rawConstant,
    rules,
    key,
    origin,
    summaryField,
    rowLayout,
    height,
  } = runInAction(() => {
    const { rampLut, rampMid } = model.wiggleColor
    return {
      sources: model.sources,
      markSources: model.markSources,
      wiggleColor: model.wiggleColor,
      scoreRamp:
        model.scoreGradientPaints && rampLut ? { rampLut, rampMid } : undefined,
      gpuProps: { ...model.gpuProps(), rowLayout: true },
      domain: resolveRenderState(model.domain, d => d),
      scaleType: model.scaleType,
      rawConstant: model.symlogConstant,
      rules: model.scoreRulesDrawn
        ? model.scoreRules.map(rule => ({
            value: rule.value,
            color: cssColorToHex(rule.color ?? DEFAULT_RULE_COLOR),
            label: rule.label ?? '',
          }))
        : [],
      key: colorKeyTables(model.colorScales),
      origin: model.origin,
      summaryField: model.summaryField,
      rowLayout: model.isRowLayout,
      height: model.height,
    }
  })
  const symlogConstant = resolveSymlogConstant(
    domain[0],
    domain[1],
    rawConstant,
  )
  const mark = readConfObject(conf, ['mark', 'type'])
  const interpolate = readConfObject(conf, ['mark', 'interpolate'])
  const regionLayers = results.map(result =>
    buildSourceRenderData(result, gpuProps).map(layer => ({
      layer,
      source: sources[layer.rowIndex]!.name,
      row: rowLayout ? layer.rowIndex : 0,
    })),
  )
  const rampFill =
    scoreRamp && scoreRampFill(domain, scaleType, rawConstant, scoreRamp)

  const marks = {
    region: [] as number[],
    source: [] as string[],
    row: [] as number[],
    layer: [] as number[],
    start: [] as number[],
    end: [] as number[],
    score: [] as number[],
    low: [] as number[],
    band: [] as boolean[],
    color: [] as string[],
    opacity: [] as number[],
    run: [] as number[],
    clipSide: [] as number[],
  }
  const scaleCode = scaleTypeCode(scaleType)
  let run = -1
  const { cuts } = wiggleColor
  const innerColors = wiggleColor.innerColors.map(cssColorToHex)
  regionLayers.forEach((layers, regionIndex) => {
    layers.forEach(({ layer, source, row }, index) => {
      const own = normalizedRgbToHex(layer.color)
      const bandColors = layer.negColor
        ? [normalizedRgbToHex(layer.negColor), ...innerColors, own]
        : undefined
      const colorAt = (score: number, i: number) =>
        rampFill
          ? cssColorToHex(rampFill(score))
          : layer.colorsAbgr
            ? abgrToHex(layer.colorsAbgr[i]!)
            : bandColors
              ? bandColors[thresholdBandOf(score, cuts)]!
              : own
      const bar = layer.renderingType === RENDERING_TYPE_XYPLOT && !layer.band
      const push = (i: number, low: number, score: number, color: string) => {
        marks.region.push(regionIndex)
        marks.source.push(source)
        marks.row.push(row)
        marks.layer.push(index)
        marks.start.push(layer.featurePositions[i * 2]!)
        marks.end.push(layer.featurePositions[i * 2 + 1]!)
        marks.score.push(score)
        marks.low.push(low)
        marks.band.push(!!layer.band)
        marks.opacity.push(layer.band ? WHISKER_BAND_OPACITY : 1)
        marks.color.push(color)
        marks.run.push(run)
        marks.clipSide.push(
          bar ? clipSide(score, domain[0], domain[1], scaleCode) : 0,
        )
      }
      run++
      const inWindow = binInWindow(regions[regionIndex]!)
      const joined =
        layer.renderingType === RENDERING_TYPE_LINE ||
        layer.renderingType === RENDERING_TYPE_LINE_CENTER
      const listed = (i: number) =>
        inWindow(layer.featurePositions, i) ||
        (joined &&
          ((i > 0 && inWindow(layer.featurePositions, i - 1)) ||
            (i + 1 < layer.numFeatures &&
              inWindow(layer.featurePositions, i + 1))))
      for (let i = 0; i < layer.numFeatures; i++) {
        if (listed(i)) {
          const score = layer.featureScores[i]!
          if (layer.band && bandColors) {
            const min = layer.band.minScores[i]!
            const edges = [
              min,
              ...cuts.filter(c => c > min && c < score),
              score,
            ]
            for (let k = 1; k < edges.length; k++) {
              push(
                i,
                edges[k - 1]!,
                edges[k]!,
                bandColors[thresholdBandOf(edges[k - 1]!, cuts)]!,
              )
            }
          } else {
            push(
              i,
              layer.band ? layer.band.minScores[i]! : origin,
              score,
              colorAt(score, i),
            )
          }
        }
      }
    })
  })

  const bins = {
    region: [] as number[],
    source: [] as string[],
    start: [] as number[],
    end: [] as number[],
    score: [] as number[],
    min: [] as number[],
    max: [] as number[],
  }
  const sourceIndex = new Map(data.sources.map((source, i) => [source.name, i]))
  const rowOrder = sources.map(source => sourceIndex.get(source.name)!)
  results.forEach((result, regionIndex) => {
    const inWindow = binInWindow(regions[regionIndex]!)
    for (const k of rowOrder) {
      const source = result.sources[k]!
      for (let i = 0; i < source.numFeatures; i++) {
        if (inWindow(source.featurePositions, i)) {
          bins.region.push(regionIndex)
          bins.source.push(source.name)
          bins.start.push(source.featurePositions[i * 2]!)
          bins.end.push(source.featurePositions[i * 2 + 1]!)
          bins.score.push(source.featureScores[i]!)
          bins.min.push(source.featureMinScores[i]!)
          bins.max.push(source.featureMaxScores[i]!)
        }
      }
    }
  })

  return {
    bins,
    marks,
    sources: {
      name: sources.map(s => s.name),
      label: sources.map(s => s.label ?? s.name),
      group: sources.map(s => s.group ?? ''),
      color: markSources.map(s => (s.color ? cssColorToHex(s.color) : '')),
    },
    rules: {
      value: rules.map(r => r.value),
      color: rules.map(r => r.color),
      label: rules.map(r => r.label),
    },
    ramps: key.ramps,
    legend: key.legend,
    legendTitle: key.legendTitle,
    scoreScale: { domain, type: scaleType, symlogConstant },
    clipStrip: { color: abgrToHex(CLIP_STRIP_COLOR), px: CLIP_STRIP_PX },
    summaryField,
    mark,
    interpolate,
    origin,
    rowLayout,
    height,
    config: fullConfSnapshot(conf),
    warnings: data.warnings ?? [],
  }
}

export type WiggleTables = Awaited<ReturnType<typeof wiggleTables>>

/**
 * #api
 * The matrix the multi-row wiggle display's "Cluster rows" clusters, over
 * `regions` at `bpPerPx` as `wiggleTables` reads them (`getScoreMatrix`):
 * `rows`, a source each, named as `wiggleTables`' `sources` names them and in
 * its order; `columns`, a pixel each, the regions end to end, with its
 * `region`'s index, the 0-based `start` of the base at its left edge, and its
 * `name`, that base 1-based after the region's contig as the call names it
 * (`ctgA:1001`); and `values`, row-major, each pixel's mean of the summary
 * the display plots over the bins covering it, placed where a log or symlog
 * axis draws it, NaN where no bin covers it.
 */
export async function wiggleScoreMatrix(
  pluginManager: PluginManager,
  args: WiggleTablesArgs,
) {
  const { adapterConfig, regions, bpPerPx } = args
  const { model } = await fetchedWiggleHost(pluginManager, args)
  const { sources, yField, scale } = runInAction(() => ({
    sources: model.sources,
    yField: model.yField,
    scale: matrixScale(model),
  }))
  const matrix = await getScoreMatrix({
    pluginManager,
    args: {
      sessionId: 'tables',
      adapterConfig,
      regions: regions.map(r => ({ assemblyName: '', ...r })),
      bpPerPx,
      sources,
      yField,
      scale,
    },
  })
  const { segments, width } = columnSegments(regions, bpPerPx)
  const columns = {
    region: [] as number[],
    start: [] as number[],
    name: [] as string[],
  }
  segments.forEach((segment, i) => {
    const { refName, originalRefName = refName } = regions[i]!
    for (let x = 0; x < segment.width; x++) {
      const start = segment.regionStart + Math.floor(x * bpPerPx)
      columns.region.push(i)
      columns.start.push(start)
      columns.name.push(`${originalRefName}:${start + 1}`)
    }
  })
  const values = new Float32Array(sources.length * width)
  sources.forEach(({ name }, row) => {
    values.set(matrix.get(name)!, row * width)
  })
  return { rows: sources.map(s => s.name), columns, values }
}

export type WiggleScoreMatrix = Awaited<ReturnType<typeof wiggleScoreMatrix>>
