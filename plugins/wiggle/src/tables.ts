import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import {
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import { rowsSettingOf } from '@jbrowse/display-kit/rowsConfigSchema'
import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'
import { thresholdBandOf } from '@jbrowse/render-core/marks'
import { orderRowsByDomain } from '@jbrowse/tree-sidebar/arrangeRows'
import { rowColorSettingOf } from '@jbrowse/tree-sidebar/rowColorChoice'
import {
  dealValueColors,
  resolveRowColors,
} from '@jbrowse/tree-sidebar/rowColorScale'
import {
  computeAutoscaleDomain,
  readYMember,
  summaryFieldOf,
  yRuleNodes,
  getNiceDomain,
  resolveRenderState,
  resolveSymlogConstant,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import linearWiggleDisplayConfigSchema from './LinearWiggleDisplay/configSchema.ts'
import { multiQuantitativeWiggleConfigSchema } from './MultiQuantitativeTrack/displaySchema.ts'
import MultiWiggleAdapterF from './MultiWiggleAdapter/index.ts'
import { executeRenderMultiWiggleData } from './RenderMultiWiggleDataRPC/executeRenderMultiWiggleData.ts'
import { renderingOf } from './renderingTypes.ts'
import { RESOLUTION_MAX, RESOLUTION_MIN } from './shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from './shared/buildSourceRenderData.ts'
import { scoreRampFill, scoreRampScale } from './shared/scoreRampScale.ts'
import { WHISKER_BAND_OPACITY } from './shared/shaders/wiggleBand.consts.generated.ts'
import {
  paintedWiggleColor,
  resolveWiggleColor,
  wiggleColorEncoding,
  wiggleColorSettingOf,
  wiggleMarkColoring,
  wiggleMarkSources,
  wiggleSharesPanel,
} from './shared/wiggleColor.ts'
import { WIGGLE_Y_PATHS } from './shared/wiggleYPaths.ts'

import type { LineInterpolation, WiggleMark } from './renderingTypes.ts'
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
  trackType?: 'QuantitativeTrack' | 'MultiQuantitativeTrack'
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
 * band's min or the origin bars grow from; `scoreScale`, the score axis the
 * display autoscales to under `encoding.y`, its `domain`, `type` and
 * `symlogConstant`; `rules`, the reference lines it draws; `ramps`, the color
 * bar its key shows where one ramp paints every row (`rampKeyOf`); and
 * `warnings`, the samples file's. For a host that draws them itself, such as
 * R through V8. The adapters must be registered on `pluginManager`
 * (`registerWiggleAdapters`).
 */
export async function wiggleTables(
  pluginManager: PluginManager,
  {
    adapterConfig,
    regions,
    display = {},
    bpPerPx,
    trackType = adapterConfig.type === 'MultiWiggleAdapter'
      ? 'MultiQuantitativeTrack'
      : 'QuantitativeTrack',
  }: WiggleTablesArgs,
) {
  const schema =
    trackType === 'MultiQuantitativeTrack'
      ? multiQuantitativeWiggleConfigSchema
      : linearWiggleDisplayConfigSchema
  const conf = schema.create({
    ...display,
    type: 'LinearWiggleDisplay',
    displayId: 'tables',
  })
  const args: RpcExecuteArgs<'RenderMultiWiggleData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: regions.map(r => ({ assemblyName: '', ...r })),
    bpPerPx,
    resolution: Math.min(
      RESOLUTION_MAX,
      Math.max(RESOLUTION_MIN, readConfObject(conf, ['data', 'resolution'])),
    ),
    yField: readConfObject(conf, ['encoding', 'y', 'field']),
    statusCallback: () => {},
  }
  if (args.regions.length === 0) {
    throw new Error('wiggleTables needs a region or regions')
  }
  const results = (await executeRenderMultiWiggleData({ pluginManager, args }))
    .value
  const data = results[0]!

  const mark: WiggleMark = readConfObject(conf, ['mark', 'type'])
  const interpolate: LineInterpolation = readConfObject(conf, [
    'mark',
    'interpolate',
  ])
  const renderingType = renderingOf(mark, interpolate)
  const density = renderingType === 'density'
  const summaryField = summaryFieldOf(
    readConfObject(conf, ['encoding', 'y', 'field']),
  )
  const extent: string = density
    ? 'none'
    : readConfObject(conf, ['mark', 'extent'])
  const origin: number = readConfObject(conf, 'origin')
  const setting = wiggleColorSettingOf(conf.encoding.color)
  const wiggleColor = resolveWiggleColor(
    wiggleColorEncoding(paintedWiggleColor(setting, { rect: density, origin })),
    origin,
  )

  const scaleType: string = readYMember(conf, WIGGLE_Y_PATHS, 'type')
  const zero = readYMember(conf, WIGGLE_Y_PATHS, 'zero') && !density
  const rules = yRuleNodes(conf, WIGGLE_Y_PATHS).map(rule => ({
    value: readConfObject(rule, 'value'),
    color: cssColorToHex(readConfObject(rule, 'color') ?? DEFAULT_RULE_COLOR),
    label: readConfObject(rule, 'label'),
  }))
  const range = computeAutoscaleDomain(
    readYMember(conf, WIGGLE_Y_PATHS, 'fence'),
    summaryField,
    results.flatMap((result, i) =>
      result.sources.map(source => ({
        data: source,
        visStart: regions[i]!.start,
        visEnd: regions[i]!.end,
      })),
    ),
    zero,
    extent,
  )
  const domain = resolveRenderState(
    range &&
      getNiceDomain({
        domain: widenRangeToRules(
          range,
          density ? [] : rules.map(r => r.value),
        ),
        bounds: [
          readYMember(conf, WIGGLE_Y_PATHS, 'domainMin') ??
            data.valueDomain?.[0],
          readYMember(conf, WIGGLE_Y_PATHS, 'domainMax') ??
            data.valueDomain?.[1],
        ],
        scaleType,
        zero,
      }),
    d => d,
  )
  const rawConstant: number = readYMember(conf, WIGGLE_Y_PATHS, 'constant')
  const symlogConstant = resolveSymlogConstant(
    domain[0],
    domain[1],
    rawConstant,
  )

  const rowLayout = !!rowsSettingOf({
    field: readConfObject(conf.rows, 'field'),
    sort: readConfObject(conf.rows, 'sort'),
  })
  const sources = orderRowsByDomain(
    data.sources,
    readConfObject(conf.rows, 'sort'),
  )
  const { gradientPaints, rowColorPaintsMarks } = wiggleMarkColoring({
    colorSetting: setting,
    wiggleColor,
    rect: density,
  })
  const paletteDeals =
    wiggleSharesPanel(rowLayout, sources.length) && rowColorPaintsMarks
  const rowColor = rowColorSettingOf(conf.rowColor)
  const rowColors = resolveRowColors(
    sources,
    rowColor.field,
    dealValueColors(rowColor, () => data.sources, paletteDeals),
    undefined,
  )
  const markSources = wiggleMarkSources(
    sources.map(s => ({ name: s.name, rowColor: rowColors.get(s.name) })),
    { rowColorPaintsMarks, paletteDeals, anyRowColored: rowColors.size > 0 },
  )
  const { rampLut, rampMid } = wiggleColor
  const scoreRamp = gradientPaints && rampLut ? { rampLut, rampMid } : undefined
  const regionLayers = results.map(result =>
    buildSourceRenderData(result, {
      sources: markSources,
      rowLayout: true,
      wiggleColor,
      origin,
      summaryField,
      effectiveExtent: extent,
      renderingType,
    }).map(layer => ({
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
  }
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
      }
      run++
      for (let i = 0; i < layer.numFeatures; i++) {
        const score = layer.featureScores[i]!
        if (layer.band && bandColors) {
          const min = layer.band.minScores[i]!
          const edges = [min, ...cuts.filter(c => c > min && c < score), score]
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
  const rowOrder = sources.map(source => data.sources.indexOf(source))
  results.forEach((result, regionIndex) => {
    for (const k of rowOrder) {
      const source = result.sources[k]!
      for (let i = 0; i < source.numFeatures; i++) {
        bins.region.push(regionIndex)
        bins.source.push(source.name)
        bins.start.push(source.featurePositions[i * 2]!)
        bins.end.push(source.featurePositions[i * 2 + 1]!)
        bins.score.push(source.featureScores[i]!)
        bins.min.push(source.featureMinScores[i]!)
        bins.max.push(source.featureMaxScores[i]!)
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
    ramps: scoreRamp
      ? [
          rampKeyOf(
            scoreRampScale(
              domain,
              scaleType,
              rawConstant,
              scoreRamp,
              readYMember(conf, WIGGLE_Y_PATHS, 'title') || 'Score',
            ),
          ),
        ]
      : [],
    scoreScale: { domain, type: scaleType, symlogConstant },
    summaryField,
    mark,
    interpolate,
    origin,
    rowLayout,
    height: readConfObject(conf, 'height'),
    config: fullConfSnapshot(conf),
    warnings: data.warnings ?? [],
  }
}

export type WiggleTables = Awaited<ReturnType<typeof wiggleTables>>
