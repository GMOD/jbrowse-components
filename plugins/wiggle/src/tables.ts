import { readConfObject } from '@jbrowse/core/configuration'
import {
  abgrToHex,
  cssColorToHex,
  normalizedRgbToHex,
} from '@jbrowse/core/util/colorBits'
import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { rowsSettingOf } from '@jbrowse/display-kit/rowsConfigSchema'
import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { orderRowsByDomain } from '@jbrowse/tree-sidebar/arrangeRows'
import {
  computeAutoscaleDomain,
  getNiceDomain,
  resolveRenderState,
  resolveSymlogConstant,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import BigWigAdapterF from './BigWigAdapter/index.ts'
import linearWiggleDisplayConfigSchema from './LinearWiggleDisplay/configSchema.ts'
import MultiWiggleAdapterF from './MultiWiggleAdapter/index.ts'
import { executeRenderMultiWiggleData } from './RenderMultiWiggleDataRPC/executeRenderMultiWiggleData.ts'
import { renderingOf } from './renderingTypes.ts'
import { RESOLUTION_MAX, RESOLUTION_MIN } from './shared/WiggleCommonMixin.ts'
import { buildSourceRenderData } from './shared/buildSourceRenderData.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './shared/getDensityColor.ts'
import { WHISKER_BAND_OPACITY } from './shared/shaders/wiggleBand.consts.generated.ts'
import {
  paintedWiggleColor,
  resolveWiggleColor,
  wiggleColorEncoding,
} from './shared/wiggleColor.ts'
import {
  centerLinksToPrevious,
  cutBand,
  isLineMode,
} from './shared/wiggleComponentUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

/** Registers the adapters `wiggleTables` reads through, BigWig and multi-wiggle. */
export function registerWiggleAdapters(pluginManager: PluginManager) {
  BigWigAdapterF(pluginManager)
  MultiWiggleAdapterF(pluginManager)
}

export interface WiggleTablesArgs {
  adapterConfig: Record<string, unknown>
  region: { refName: string; start: number; end: number }
  /**
   * The display's config as a track's `displays` entry writes it for a
   * `LinearWiggleDisplay`: `mark`, `interpolate`, `aggregate`, `extent`,
   * `origin`, `color`, `scales`, `rows`, `resolution` and the rest of its
   * slots. Unset reads the default display.
   */
  display?: Record<string, unknown>
  /**
   * The zoom the display draws at, in bp per screen px: what decides which
   * of a BigWig's zoom levels answers, and so how wide each bin is.
   */
  bpPerPx: number
}

/**
 * #api
 * A region of a quantitative track as the wiggle display fetches, scales and
 * colors it, as tables: `bins`, each source's scores as the worker ships them
 * at this zoom (the bin's score, and its min and max where the file
 * summarizes); `marks`, the layers the display's encoder builds from them in
 * paint order (the aggregate, and under a min-max extent the tinted max and
 * min bands, or a line's min-to-max `band`), each mark in the color it paints
 * and reaching down to `low`, the band's min or the origin bars grow from; `domain`, the score axis the
 * display autoscales to under `scales.y`; and `rules`, the reference lines it
 * draws. For a host that draws them itself, such as R through V8. The
 * adapters must be registered on `pluginManager` (`registerWiggleAdapters`).
 */
export async function wiggleTables(
  pluginManager: PluginManager,
  { adapterConfig, region, display = {}, bpPerPx }: WiggleTablesArgs,
) {
  const conf = linearWiggleDisplayConfigSchema.create({
    ...display,
    type: 'LinearWiggleDisplay',
    displayId: 'tables',
  })
  const args: RpcExecuteArgs<'RenderMultiWiggleData'> = {
    sessionId: 'tables',
    adapterConfig,
    regions: [{ assemblyName: '', ...region }],
    bpPerPx,
    resolution: Math.min(
      RESOLUTION_MAX,
      Math.max(RESOLUTION_MIN, readConfObject(conf, 'resolution')),
    ),
    scoreField: readConfObject(conf, 'y'),
    statusCallback: () => {},
  }
  const data = (await executeRenderMultiWiggleData({ pluginManager, args }))
    .value[0]!

  const renderingType = renderingOf(
    readConfObject(conf, 'mark'),
    readConfObject(conf, 'interpolate'),
  )
  const density = renderingType === 'density'
  const aggregate: string = readConfObject(conf, 'aggregate')
  const extent: string = density ? 'none' : readConfObject(conf, 'extent')
  const origin: number = readConfObject(conf, 'origin')
  const setting = colorSettingOf(conf.color)
  const wiggleColor = resolveWiggleColor(
    wiggleColorEncoding(
      paintedWiggleColor({
        ...setting,
        field: setting.field ?? '',
        labels: readConfObject(conf.color, 'labels'),
        title: readConfObject(conf.color, 'title'),
      }),
    ),
    origin,
  )

  const scale = conf.scales.y
  const scaleType: string = readConfObject(scale, 'type')
  const zero = readConfObject(scale, 'zero') && !density
  const rules = (scale.rules as Parameters<typeof readConfObject>[0][]).map(
    rule => ({
      value: readConfObject(rule, 'value') as number,
      color: cssColorToHex(
        (readConfObject(rule, 'color') as string | undefined) ??
          DEFAULT_RULE_COLOR,
      ),
      label: (readConfObject(rule, 'label') as string | undefined) ?? '',
    }),
  )
  const range = computeAutoscaleDomain(
    readConfObject(scale, 'domainQuantile'),
    aggregate,
    data.sources.map(source => ({
      data: source,
      visStart: region.start,
      visEnd: region.end,
    })),
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
          readConfObject(scale, 'domainMin') ?? data.valueDomain?.[0],
          readConfObject(scale, 'domainMax') ?? data.valueDomain?.[1],
        ],
        scaleType,
        zero,
      }),
    d => d,
  )
  const symlogConstant = resolveSymlogConstant(
    domain[0],
    domain[1],
    readConfObject(scale, 'symlogConstant'),
  )

  const rowLayout = !!rowsSettingOf({
    field: readConfObject(conf.rows, 'field'),
    domain: readConfObject(conf.rows, 'domain'),
  })
  const maxGapMultiple: number = readConfObject(conf, 'maxGapMultiple')
  const sources = orderRowsByDomain(
    data.sources,
    readConfObject(conf.rows, 'domain'),
  )
  const layers = buildSourceRenderData(data, {
    sources: sources.map(s => ({ name: s.name, color: s.color })),
    rowLayout: true,
    perSource: false,
    wiggleColor,
    origin,
    aggregate,
    effectiveExtent: extent,
    renderingType,
    maxGapMultiple,
  }).map(layer => ({
    layer,
    source: sources[layer.rowIndex]!.name,
    row: rowLayout ? layer.rowIndex : 0,
  }))
  const scaleCode = scaleTypeCode(scaleType)
  const gradient =
    wiggleColor.rampLut !== null && !isLineMode(renderingType) && !density
  const colorOf = (layer: SourceRenderData) => {
    if (density) {
      if (wiggleColor.rampLut) {
        return makeDensityLutFillFn(
          domain[0],
          domain[1],
          scaleCode,
          wiggleColor.rampLut,
          wiggleColor.rampMid,
          symlogConstant,
        )
      }
      const [r, g, b] = layer.color.map(c => c * 255)
      return makeDensityRgbStringFn(
        domain[0],
        domain[1],
        scaleCode,
        r!,
        g!,
        b!,
        wiggleColor.pivot,
        symlogConstant,
      )
    }
    return gradient
      ? makeDensityLutFillFn(
          domain[0],
          domain[1],
          scaleCode,
          wiggleColor.rampLut!,
          wiggleColor.rampMid,
          symlogConstant,
        )
      : undefined
  }

  const marks = {
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
  layers.forEach(({ layer, source, row }, index) => {
    const fill = colorOf(layer)
    const own = normalizedRgbToHex(layer.color)
    const bandColors = layer.negColor
      ? [normalizedRgbToHex(layer.negColor), ...innerColors, own]
      : undefined
    const colorAt = (score: number, i: number) =>
      fill
        ? cssColorToHex(fill(score))
        : layer.colorsAbgr
          ? abgrToHex(layer.colorsAbgr[i]!)
          : bandColors
            ? bandColors[cutBand(score, cuts)]!
            : own
    const push = (i: number, low: number, score: number, color: string) => {
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
    const gapLimitBp = layer.gapLimitBp ?? Number.POSITIVE_INFINITY
    for (let i = 0; i < layer.numFeatures; i++) {
      const score = layer.featureScores[i]!
      if (!centerLinksToPrevious(layer.featurePositions, i, gapLimitBp)) {
        run++
      }
      if (layer.band && bandColors) {
        const min = layer.band.minScores[i]!
        const edges = [min, ...cuts.filter(c => c > min && c < score), score]
        for (let k = 1; k < edges.length; k++) {
          push(
            i,
            edges[k - 1]!,
            edges[k]!,
            bandColors[cutBand(edges[k - 1]!, cuts)]!,
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

  const bins = {
    source: [] as string[],
    start: [] as number[],
    end: [] as number[],
    score: [] as number[],
    min: [] as number[],
    max: [] as number[],
  }
  for (const source of sources) {
    for (let i = 0; i < source.numFeatures; i++) {
      bins.source.push(source.name)
      bins.start.push(source.featurePositions[i * 2]!)
      bins.end.push(source.featurePositions[i * 2 + 1]!)
      bins.score.push(source.featureScores[i]!)
      bins.min.push(source.featureMinScores[i]!)
      bins.max.push(source.featureMaxScores[i]!)
    }
  }

  return {
    bins,
    marks,
    sources: {
      name: sources.map(s => s.name),
      label: sources.map(s => s.label ?? s.name),
      group: sources.map(s => s.group ?? ''),
      color: sources.map(s => s.color ?? ''),
    },
    rules: {
      value: rules.map(r => r.value),
      color: rules.map(r => r.color),
      label: rules.map(r => r.label),
    },
    domain,
    scaleType,
    symlogConstant,
    rendering: renderingType,
    origin,
    rowLayout,
  }
}

export type WiggleTables = Awaited<ReturnType<typeof wiggleTables>>
