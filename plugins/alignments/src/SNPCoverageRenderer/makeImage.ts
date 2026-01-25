import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  checkStopToken2,
  featureSpanPx,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import {
  YSCALEBAR_LABEL_OFFSET,
  getOrigin,
  getScale,
} from '@jbrowse/plugin-wiggle'

import { buildClickMap } from './buildClickMap.ts'
import { fudgeFactor } from './constants.ts'
import { drawCrossHatches } from './drawCrossHatches.ts'
import { drawSecondPassMethylation } from './drawSecondPassMethylation.ts'
import { drawSecondPassModifications } from './drawSecondPassModifications.ts'
import { drawSecondPassSNPs } from './drawSecondPassSNPs.ts'

import type {
  ClickMapItem,
  ReducedFeature,
  RenderArgsDeserializedWithFeatures,
  SecondPassContext,
  SkipFeatureSerialized,
} from './types'
import type { Feature } from '@jbrowse/core/util'

export async function renderSNPCoverageToCanvas(
  props: RenderArgsDeserializedWithFeatures,
) {
  const { features, regions, bpPerPx, adapterConfig } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const height = props.height
  const adapterId = adapterConfig.adapterId ?? 'unknown'

  const skipFeatures: SkipFeatureSerialized[] = []
  const coverageFeatures: Feature[] = []

  for (const feature of features.values()) {
    if (feature.get('type') === 'skip') {
      skipFeatures.push({
        uniqueId: feature.id(),
        type: 'skip',
        refName: region.refName,
        start: feature.get('start'),
        end: feature.get('end'),
        strand: feature.get('strand'),
        score: feature.get('score'),
        effectiveStrand: feature.get('effectiveStrand'),
      })
    } else {
      coverageFeatures.push(feature)
    }
  }

  const { reducedFeatures, coords, items, ...rest } =
    await renderToAbstractCanvas(width, height, props, ctx =>
      drawSNPCoverage(ctx, props, coverageFeatures),
    )

  const serialized = {
    ...rest,
    features: reducedFeatures.map((f, idx) => ({
      ...f,
      uniqueId: `${adapterId}-${f.start}-${idx}`,
    })),
    skipFeatures,
    clickMap: buildClickMap(coords, items),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}

function drawSNPCoverage(
  ctx: CanvasRenderingContext2D,
  props: RenderArgsDeserializedWithFeatures,
  coverageFeatures: Feature[],
) {
  const {
    regions,
    bpPerPx,
    colorBy,
    displayCrossHatches,
    visibleModifications = {},
    simplexModifications = [],
    scaleOpts,
    height: unadjustedHeight,
    theme: configTheme,
    config: cfg,
    ticks,
    stopTokenCheck,
  } = props
  const theme = createJBrowseTheme(configTheme)
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const offset = YSCALEBAR_LABEL_OFFSET
  const height = unadjustedHeight - offset * 2

  const opts = { ...scaleOpts, range: [0, height] }
  const viewScale = getScale(opts)

  const indicatorViewScale = getScale({
    ...opts,
    range: [0, height / 2],
    scaleType: 'linear',
  })
  const originY = getOrigin(scaleOpts.scaleType)

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  const toY = (n: number) => height - (viewScale(n) || 0) + offset
  const toHeight = (n: number) => toY(originY) - toY(n)
  const toHeight2 = (n: number) => indicatorViewScale(n) || 0

  const { bases, softclip, hardclip, insertion } = theme.palette
  const colorMap: Record<string, string> = {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    insertion,
    softclip,
    hardclip,
    total: readConfObject(cfg, 'color'),
    mod_NONE: 'blue',
    cpg_meth: 'red',
    cpg_unmeth: 'blue',
  }

  const reducedFeatures: ReducedFeature[] = []
  let prevReducedLeftPx = Number.NEGATIVE_INFINITY

  const coords: number[] = []
  const items: ClickMapItem[] = []

  // First pass: draw the gray background
  ctx.fillStyle = colorMap.total!
  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(stopTokenCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const w = rightPx - leftPx + fudgeFactor
    const score = feature.get('score') as number
    ctx.fillRect(leftPx, toY(score), w, toHeight(score))

    if (leftPx > prevReducedLeftPx + 1) {
      reducedFeatures.push({
        start: feature.get('start'),
        end: feature.get('end'),
        score,
        snpinfo: feature.get('snpinfo'),
        refName: region.refName,
      })
      prevReducedLeftPx = leftPx
    }
  }

  const extraHorizontallyFlippedOffset = region.reversed ? 1 / bpPerPx : 0

  const passCtx: SecondPassContext = {
    ctx,
    coverageFeatures,
    region,
    bpPerPx,
    colorMap,
    toY,
    toHeight,
    toHeight2,
    stopTokenCheck,
    extraHorizontallyFlippedOffset,
    coords,
    items,
    indicatorThreshold,
    showInterbaseCounts,
    showInterbaseIndicators,
  }

  // Second pass: draw colored data based on colorBy mode
  if (colorBy.type === 'modifications') {
    const isolatedModification = colorBy.modifications?.isolatedModification
    const simplexSet = new Set(simplexModifications)
    drawSecondPassModifications(
      passCtx,
      visibleModifications,
      isolatedModification,
      simplexSet,
    )
  } else if (colorBy.type === 'methylation') {
    drawSecondPassMethylation(passCtx)
  } else {
    drawSecondPassSNPs(passCtx)
  }

  if (displayCrossHatches) {
    drawCrossHatches(ctx, ticks, width, toY)
  }

  return { reducedFeatures, coords, items }
}
