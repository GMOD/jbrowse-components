import { fullConfSnapshot, readConfObject } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import {
  abgrBlue,
  abgrGreen,
  abgrRed,
  cssColorToABGR,
} from '@jbrowse/core/util/colorBits'

import { labelColors } from './LinearBasicDisplay/components/labelColors.ts'
import { forEachDisplayLabel } from './LinearBasicDisplay/components/labelPositioning.ts'
import { resolveMapColors } from './LinearBasicDisplay/components/resolveRegionColors.ts'
import configSchemaFactory from './LinearBasicDisplay/configSchema.ts'
import { featureColorKey } from './LinearBasicDisplay/derivedColorKey.ts'
import { resolvedGeneGlyphMode } from './LinearBasicDisplay/geneGlyphMode.ts'
import { computeLaidOutData } from './LinearBasicDisplay/layout.ts'
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

function hex(n: number) {
  return n.toString(16).padStart(2, '0')
}

function hexOfAbgr(c: number) {
  return `#${hex(abgrRed(c))}${hex(abgrGreen(c))}${hex(abgrBlue(c))}`
}

function hexOfCss(css: string) {
  return hexOfAbgr(cssColorToABGR(css))
}

function pairs(a: ArrayLike<number>) {
  const first: number[] = []
  const second: number[] = []
  for (let i = 0; i + 1 < a.length; i += 2) {
    first.push(a[i]!)
    second.push(a[i + 1]!)
  }
  return [first, second] as const
}

/**
 * The intron lines' chevrons where the display draws them: each line wide
 * enough on screen gets `chevronCount` of them, spaced by `chevronOffset`,
 * pointing along its direction.
 */
function chevrons(
  d: FeatureDataResult,
  starts: number[],
  ends: number[],
  bpPerPx: number,
) {
  const out = {
    position: [] as number[],
    y: [] as number[],
    direction: [] as number[],
    color: [] as string[],
    feature: [] as number[],
  }
  for (let i = 0; i < starts.length; i++) {
    const direction = d.lineDirections[i]!
    const widthPx = (ends[i]! - starts[i]!) / bpPerPx
    if (direction !== 0 && showChevrons(widthPx)) {
      const count = chevronCount(widthPx)
      for (let c = 0; c < count; c++) {
        out.position.push(
          starts[i]! + chevronOffset(widthPx, count, c) * bpPerPx,
        )
        out.y.push(d.lineYs[i]!)
        out.direction.push(direction)
        out.color.push(hexOfAbgr(d.lineColors[i]!))
        out.feature.push(d.lineFeatureIndices[i]!)
      }
    }
  }
  return out
}

/**
 * The strand arrows off feature ends where the display draws them: a feature
 * narrower on screen than `arrowDraws` allows gets none.
 */
function arrows(d: FeatureDataResult, bpPerPx: number) {
  const out = {
    position: [] as number[],
    y: [] as number[],
    direction: [] as number[],
    headHalfHeight: [] as number[],
    color: [] as string[],
    feature: [] as number[],
  }
  for (let i = 0; i < d.arrowXs.length; i++) {
    if (arrowDraws(d.arrowWidthsBp[i]! / bpPerPx, d.arrowGene[i] === 1)) {
      out.position.push(d.arrowXs[i]!)
      out.y.push(d.arrowYs[i]!)
      out.direction.push(d.arrowDirections[i]!)
      out.headHalfHeight.push(arrowHeadHalfHeightPx(d.arrowHeights[i]!))
      out.color.push(hexOfAbgr(d.arrowColors[i]!))
      out.feature.push(d.arrowFeatureIndices[i]!)
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
 * into `features`. The layout is the display's grown to its content: every
 * feature placed, nothing trimmed to a track height.
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
  const args: RpcExecuteArgs<'RenderFeatureData'> = {
    sessionId: 'tables',
    adapterConfig,
    sequenceAdapter,
    region: { assemblyName: '', ...region },
    displayConfig: {
      ...pickDisplayConfig(fullConfSnapshot(conf)),
      subfeatureLabels: collapsed
        ? 'none'
        : readConfObject(conf, 'subfeatureLabels'),
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
  const laid = computeLaidOutData(
    new Map([[0, { ...raw, regionKey: region.refName }]]),
    {
      bpPerPx,
      showLabels: visibility.showLabels,
      showDescriptions: visibility.showDescriptions,
      geneNamesOnly: visibility.geneNamesOnly,
      reversedRegions: new Set(),
      displayMode,
      pinnedFeatureIds: new Set(),
    },
  )
  const palette = resolvePalette()
  const colors = featureColorViews({
    conf: { color: conf.color },
    rpcDataMap: new Map([[0, raw]]),
  })
  const d = resolveMapColors(laid, palette, colors.fieldPalette).get(0)!
  const fontSize = labelFontSize(displayMode)

  const labels = {
    text: [] as string[],
    kind: [] as string[],
    position: [] as number[],
    y: [] as number[],
    color: [] as string[],
    feature: [] as number[],
  }
  const featureIndex = new Map(
    d.flatbushItems.map((item, i) => [item.featureId, i]),
  )
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
      showLabels: visibility.showLabels,
      showDescriptions: visibility.showDescriptions,
      showSubfeatureLabels: true,
      fontSize,
      colors: labelColors(palette),
    },
    (featureId, placed) => {
      for (const p of placed) {
        if (p.kind !== 'more') {
          labels.text.push(p.label.text)
          labels.kind.push(p.kind === 'desc' ? 'description' : p.kind)
          labels.position.push(region.start + p.labelX * bpPerPx)
          labels.y.push(p.labelY)
          labels.color.push(hexOfCss(p.color))
          labels.feature.push(featureIndex.get(featureId) ?? -1)
        }
      }
    },
  )

  const [rectStart, rectEnd] = pairs(d.rectPositions)
  const [lineStart, lineEnd] = pairs(d.linePositions)
  const hideChevrons = !readConfObject(conf, 'displayDirectionalChevrons')
  const key = featureColorKey(colors, [raw]).find(
    scale => scale.kind === 'categorical',
  )
  const entries = key?.entries.filter(e => e.color !== undefined) ?? []
  const items = d.flatbushItems
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
      id: d.subfeatureInfos.map(s => s.featureId),
      name: d.subfeatureInfos.map(s => s.displayLabel ?? ''),
      type: d.subfeatureInfos.map(s => s.type ?? ''),
      start: d.subfeatureInfos.map(s => s.startBp),
      end: d.subfeatureInfos.map(s => s.endBp),
      top: d.subfeatureInfos.map(s => s.topPx),
      bottom: d.subfeatureInfos.map(s => s.bottomPx),
      feature: d.subfeatureInfos.map(
        s => featureIndex.get(s.parentFeatureId) ?? -1,
      ),
    },
    rects: {
      start: rectStart,
      end: rectEnd,
      top: Array.from(d.rectYs),
      height: Array.from(d.rectHeights),
      color: Array.from(d.rectColors, hexOfAbgr),
      feature: Array.from(d.rectFeatureIndices),
    },
    lines: {
      start: lineStart,
      end: lineEnd,
      y: Array.from(d.lineYs),
      color: Array.from(d.lineColors, hexOfAbgr),
      feature: Array.from(d.lineFeatureIndices),
    },
    chevrons: hideChevrons
      ? chevrons(d, [], [], bpPerPx)
      : chevrons(d, lineStart, lineEnd, bpPerPx),
    arrows: arrows(d, bpPerPx),
    labels,
    legend: {
      label: entries.map(e => e.label),
      color: entries.map(e => hexOfCss(e.color!)),
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
    height: Math.max(0, ...items.map(item => item.bottomPx)),
    bpPerPx,
  }
}

export type FeatureTables = Awaited<ReturnType<typeof featureTables>>
