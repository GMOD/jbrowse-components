import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  checkStopToken2,
  createStopTokenChecker,
  featureSpanPx,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import {
  YSCALEBAR_LABEL_OFFSET,
  getOrigin,
  getScale,
} from '@jbrowse/plugin-wiggle'

import { alphaColor } from '../shared/util.ts'

import type {
  ClickMapItem,
  InterbaseIndicatorItem,
  RenderArgsDeserializedWithFeatures,
} from './types.ts'
import type { BaseCoverageBin } from '../shared/types.ts'
import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'

// width/height of the triangle above e.g. insertion indicators
const INTERBASE_INDICATOR_WIDTH = 7
const INTERBASE_INDICATOR_HEIGHT = 4.5

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

// threshold for drawing interbase counts when zoomed out (to avoid skipping
// significant signals due to pixel collision optimization)
const INTERBASE_DRAW_THRESHOLD = 0.1

const complementBase = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
} as const

const fudgeFactor = 0.6
const SNP_CLICKMAP_THRESHOLD = 0.04

interface SecondPassContext {
  ctx: CanvasRenderingContext2D
  coverageFeatures: Feature[]
  region: { start: number; end: number; refName: string; reversed?: boolean }
  bpPerPx: number
  colorMap: Record<string, string>
  toY: (n: number) => number
  toHeight: (n: number) => number
  toHeight2: (n: number) => number
  lastCheck: LastStopTokenCheck
  extraHorizontallyFlippedOffset: number
  coords: number[]
  items: ClickMapItem[]
  indicatorThreshold: number
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
}

interface SecondPassStats {
  snpDrawn: number
  snpSkipped: number
}

interface StrandCounts {
  readonly entryDepth: number
  readonly '1': number
  readonly '-1': number
  readonly '0': number
}

interface ModificationCountsParams {
  readonly base: string
  readonly isSimplex: boolean
  readonly refbase: string | undefined
  readonly snps: Readonly<Record<string, Partial<StrandCounts>>>
  readonly ref: StrandCounts
  readonly score0: number
}

interface ModificationCountsResult {
  readonly modifiable: number
  readonly detectable: number
}

interface ReducedFeature {
  start: number
  end: number
  score: number
  snpinfo: BaseCoverageBin
  refName: string
}

interface SkipFeatureSerialized {
  uniqueId: string
  type: 'skip'
  refName: string
  start: number
  end: number
  strand: number
  score: number
  effectiveStrand: number
}

function createInterbaseItem(
  maxBase: string,
  count: number,
  total: number,
  start: number,
  maxEntry?: {
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  },
): InterbaseIndicatorItem {
  return {
    type: maxBase as 'insertion' | 'softclip' | 'hardclip',
    base: maxBase,
    count,
    total,
    avgLength: maxEntry?.avgLength,
    minLength: maxEntry?.minLength,
    maxLength: maxEntry?.maxLength,
    topSequence: maxEntry?.topSequence,
    start,
  }
}

function drawStackedBars(
  ctx: CanvasRenderingContext2D,
  entries: Record<string, { entryDepth: number }>,
  colorMap: Record<string, string>,
  x: number,
  bottom: number,
  w: number,
  h: number,
  depth: number,
  startCurr: number,
) {
  let curr = startCurr
  for (const base in entries) {
    const { entryDepth } = entries[base]!
    ctx.fillStyle = colorMap[base] || 'black'
    ctx.fillRect(
      x,
      bottom - ((entryDepth + curr) / depth) * h,
      w,
      (entryDepth / depth) * h,
    )
    curr += entryDepth
  }
  return curr
}

function drawCrossHatches(
  ctx: CanvasRenderingContext2D,
  ticks: { values: number[] },
  width: number,
  toY: (n: number) => number,
) {
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(140,140,140,0.8)'
  for (const tick of ticks.values) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(toY(tick)))
    ctx.lineTo(width, Math.round(toY(tick)))
    ctx.stroke()
  }
}

function calculateModificationCounts({
  base,
  isSimplex,
  refbase,
  snps,
  ref,
  score0,
}: ModificationCountsParams): ModificationCountsResult {
  if (base === 'N') {
    return { modifiable: score0, detectable: score0 }
  }

  const cmp = complementBase[base as keyof typeof complementBase]

  const baseCount =
    (snps[base]?.entryDepth || 0) + (refbase === base ? ref.entryDepth : 0)
  const complCount =
    (snps[cmp]?.entryDepth || 0) + (refbase === cmp ? ref.entryDepth : 0)

  const modifiable = baseCount + complCount

  const detectable = isSimplex
    ? (snps[base]?.['1'] || 0) +
      (snps[cmp]?.['-1'] || 0) +
      (refbase === base ? ref['1'] : 0) +
      (refbase === cmp ? ref['-1'] : 0)
    : modifiable

  return { modifiable, detectable }
}

function buildClickMap(coords: number[], items: ClickMapItem[]) {
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()
  return {
    flatbush: flatbush.data,
    items,
  }
}

function drawNoncovEvents(
  passCtx: SecondPassContext,
  snpinfo: BaseCoverageBin,
  leftPx: number,
  score0: number,
  prevTotal: number,
  skipDraw: boolean,
  fstart: number,
) {
  const {
    ctx,
    colorMap,
    toHeight2,
    extraHorizontallyFlippedOffset,
    coords,
    items,
    bpPerPx,
    indicatorThreshold,
    showInterbaseCounts,
    showInterbaseIndicators,
  } = passCtx

  let totalCount = 0
  let maxDepth = 0
  let maxBase = ''
  let totalHeight = 0
  const r = 0.6
  const x = leftPx - r + extraHorizontallyFlippedOffset

  for (const base in snpinfo.noncov) {
    const { entryDepth } = snpinfo.noncov[base]!
    totalCount += entryDepth
    if (entryDepth > maxDepth) {
      maxDepth = entryDepth
      maxBase = base
    }
  }

  // allow significant interbase signals to be drawn even when skipDraw is true
  // (similar to SNP drawing logic)
  const isSignificant = score0 > 0 && totalCount > score0 * INTERBASE_DRAW_THRESHOLD
  const showCounts = showInterbaseCounts && (!skipDraw || isSignificant)

  if (showCounts) {
    for (const base in snpinfo.noncov) {
      const { entryDepth } = snpinfo.noncov[base]!
      const barHeight = toHeight2(entryDepth)
      ctx.fillStyle = colorMap[base]!
      ctx.fillRect(
        x,
        INTERBASE_INDICATOR_HEIGHT + totalHeight,
        r * 2,
        barHeight,
      )
      totalHeight += barHeight
    }
  }

  if (totalCount > 0) {
    const maxEntry = snpinfo.noncov[maxBase]

    if (showCounts) {
      if (bpPerPx < 50 || isSignificant) {
        const clickWidth = Math.max(r * 2, 2)
        coords.push(
          x,
          INTERBASE_INDICATOR_HEIGHT,
          x + clickWidth,
          INTERBASE_INDICATOR_HEIGHT + totalHeight,
        )
        items.push(
          createInterbaseItem(maxBase, totalCount, score0, fstart, maxEntry),
        )
      }
    }

    if (showInterbaseIndicators && (!skipDraw || isSignificant)) {
      const indicatorComparatorScore = Math.max(score0, prevTotal)
      if (
        totalCount > indicatorComparatorScore * indicatorThreshold &&
        indicatorComparatorScore > MINIMUM_INTERBASE_INDICATOR_READ_DEPTH
      ) {
        ctx.fillStyle = colorMap[maxBase]!
        ctx.beginPath()
        const l = leftPx + extraHorizontallyFlippedOffset
        ctx.moveTo(l - INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l + INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l, INTERBASE_INDICATOR_HEIGHT)
        ctx.fill()

        const hitboxPadding = 1
        coords.push(
          l - INTERBASE_INDICATOR_WIDTH / 2 - hitboxPadding,
          0,
          l + INTERBASE_INDICATOR_WIDTH / 2 + hitboxPadding,
          INTERBASE_INDICATOR_HEIGHT + hitboxPadding,
        )
        items.push(
          createInterbaseItem(
            maxBase,
            totalCount,
            indicatorComparatorScore,
            fstart,
            maxEntry,
          ),
        )
      }
    }
  }
}

function drawSecondPassModifications(
  passCtx: SecondPassContext,
  visibleModifications: Record<
    string,
    { base: string; type: string; color?: string }
  >,
  isolatedModification: string | undefined,
  simplexSet: Set<string>,
): SecondPassStats {
  const { ctx, coverageFeatures, region, bpPerPx, toY, toHeight, lastCheck } =
    passCtx

  let snpDrawn = 0
  let snpSkipped = 0
  let lastDrawnX = Number.NEGATIVE_INFINITY
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    let curr = 0
    const refbase = snpinfo.refbase?.toUpperCase()
    const { nonmods, mods, snps, ref } = snpinfo
    const h = toHeight(score0)
    const bottom = toY(score0) + h

    for (const key in nonmods) {
      const modKey = key.slice(7)
      const mod = visibleModifications[modKey]
      if (!mod || (isolatedModification && mod.type !== isolatedModification)) {
        continue
      }

      const { modifiable, detectable } = calculateModificationCounts({
        base: mod.base,
        isSimplex: simplexSet.has(mod.type),
        refbase,
        snps,
        ref,
        score0,
      })

      const { entryDepth, avgProbability = 0 } = nonmods[key]!
      const modFraction = (modifiable / score0) * (entryDepth / detectable)
      const barHeight = modFraction * h
      if (skipDraw) {
        snpSkipped++
      } else {
        ctx.fillStyle = alphaColor('blue', avgProbability)
        ctx.fillRect(drawX, bottom - (curr + barHeight), w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
      }
      curr += barHeight
    }

    for (const key in mods) {
      const modKey = key.slice(4)
      const mod = visibleModifications[modKey]
      if (!mod || (isolatedModification && mod.type !== isolatedModification)) {
        continue
      }

      const { modifiable, detectable } = calculateModificationCounts({
        base: mod.base,
        isSimplex: simplexSet.has(mod.type),
        refbase,
        snps,
        ref,
        score0,
      })

      const { entryDepth, avgProbability = 0 } = mods[key]!
      const modFraction = (modifiable / score0) * (entryDepth / detectable)
      const barHeight = modFraction * h
      if (skipDraw) {
        snpSkipped++
      } else {
        ctx.fillStyle = alphaColor(mod.color || 'black', avgProbability)
        ctx.fillRect(drawX, bottom - (curr + barHeight), w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
      }
      curr += barHeight
    }

    drawNoncovEvents(
      passCtx,
      snpinfo,
      leftPx,
      score0,
      prevTotal,
      skipDraw,
      feature.get('start'),
    )
    prevTotal = score0
  }

  return { snpDrawn, snpSkipped }
}

function drawSecondPassMethylation(
  passCtx: SecondPassContext,
): SecondPassStats {
  const {
    ctx,
    coverageFeatures,
    region,
    bpPerPx,
    colorMap,
    toY,
    toHeight,
    lastCheck,
  } = passCtx

  let lastDrawnX = Number.NEGATIVE_INFINITY
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    if (!skipDraw) {
      const { depth, nonmods, mods } = snpinfo
      const h = toHeight(score0)
      const bottom = toY(score0) + h
      const curr = drawStackedBars(
        ctx,
        mods,
        colorMap,
        drawX,
        bottom,
        w,
        h,
        depth,
        0,
      )
      drawStackedBars(ctx, nonmods, colorMap, drawX, bottom, w, h, depth, curr)
      lastDrawnX = drawX
    }

    drawNoncovEvents(
      passCtx,
      snpinfo,
      leftPx,
      score0,
      prevTotal,
      skipDraw,
      feature.get('start'),
    )
    prevTotal = score0
  }

  return { snpDrawn: 0, snpSkipped: 0 }
}

function drawSecondPassSNPs(passCtx: SecondPassContext): SecondPassStats {
  const {
    ctx,
    coverageFeatures,
    region,
    bpPerPx,
    colorMap,
    toY,
    toHeight,
    lastCheck,
    coords,
    items,
  } = passCtx

  let snpDrawn = 0
  let snpSkipped = 0
  let lastDrawnX = Number.NEGATIVE_INFINITY
  let lastDrawnDepth = -1
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    const { depth, snps, refbase } = snpinfo
    const refbaseUpper = refbase?.toUpperCase()
    const h = toHeight(score0)
    const bottom = toY(score0) + h
    let curr = 0

    for (const base in snps) {
      const entry = snps[base]!
      const { entryDepth } = entry
      const y1 = bottom - ((entryDepth + curr) / depth) * h
      const barHeight = (entryDepth / depth) * h
      const isSignificant = entryDepth / score0 >= SNP_CLICKMAP_THRESHOLD

      const sameDepthAtSameX = skipDraw && entryDepth === lastDrawnDepth
      if ((skipDraw && !isSignificant) || sameDepthAtSameX) {
        snpSkipped++
      } else {
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(drawX, y1, w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
        lastDrawnDepth = entryDepth
      }

      if (isSignificant) {
        coords.push(drawX, y1, drawX + w, y1 + barHeight)
        items.push({
          type: 'snp',
          base,
          count: entryDepth,
          total: score0,
          refbase: refbaseUpper,
          avgQual: entry.avgProbability,
          fwdCount: entry['1'] || 0,
          revCount: entry['-1'] || 0,
          bin: snpinfo,
          start: feature.get('start'),
          end: feature.get('end'),
        })
      }
      curr += entryDepth
    }

    drawNoncovEvents(
      passCtx,
      snpinfo,
      leftPx,
      score0,
      prevTotal,
      skipDraw,
      feature.get('start'),
    )
    prevTotal = score0
  }

  return { snpDrawn, snpSkipped }
}

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
    stopToken,
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
  const lastCheck = createStopTokenChecker(stopToken)
  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
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
    lastCheck,
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
