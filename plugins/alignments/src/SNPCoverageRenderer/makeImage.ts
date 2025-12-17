import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { checkStopToken2, renderToAbstractCanvas } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { getOrigin, getScale } from '@jbrowse/plugin-wiggle'
import { rpcResult } from 'librpc-web-mod'

import { calculateModificationCounts } from './calculateModificationCounts'
import { alphaColor } from '../shared/util'

import type {
  InterbaseIndicatorItem,
  RenderArgsDeserializedWithFeatures,
} from './types'
import type { BaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

// width/height of the triangle above e.g. insertion indicators
const INTERBASE_INDICATOR_WIDTH = 7
const INTERBASE_INDICATOR_HEIGHT = 4.5
const INTERBASE_INDICATOR_HALF_WIDTH = INTERBASE_INDICATOR_WIDTH / 2

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

const fudgeFactor = 0.6

const sortedKeysDesc = (obj: object) => Object.keys(obj).sort().reverse()

function findMaxBase(noncov: Record<string, { entryDepth: number }>) {
  let max = 0
  let maxBase = ''
  for (const [base, entry] of Object.entries(noncov)) {
    if (entry.entryDepth > max) {
      max = entry.entryDepth
      maxBase = base
    }
  }
  return { maxBase, max }
}

function createInterbaseItem(
  maxBase: string,
  count: number,
  total: number,
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
  for (const base of sortedKeysDesc(entries)) {
    const entryDepth = entries[base]!.entryDepth
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

export function makeImage(
  ctx: CanvasRenderingContext2D,
  props: RenderArgsDeserializedWithFeatures,
) {
  const {
    features,
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
    offset = 0,
  } = props
  const theme = createJBrowseTheme(configTheme)
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  // the adjusted height takes into account offset from the wiggle display,
  // and makes the height of the actual drawn area add "padding" to the top
  // and bottom of the display
  const height = unadjustedHeight - offset * 2

  // Use d3-scale only to get the "niced" domain, then use simple arithmetic
  const viewScale = getScale({ ...scaleOpts, range: [0, height] })
  const [domainMin, domainMax] = viewScale.domain() as [number, number]
  const domainSpan = domainMax - domainMin
  const originY = getOrigin(scaleOpts.scaleType)
  const isLog = scaleOpts.scaleType === 'log'

  // Precompute values for linear scale
  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0

  // Precompute values for log scale (base 2)
  const log2 = Math.log(2)
  const logMin = Math.log(domainMin) / log2
  const logMax = Math.log(domainMax) / log2
  const logSpan = logMax - logMin
  const logRatio = logSpan !== 0 ? height / logSpan : 0

  // For indicator scale, always linear with half height
  // For log scale, use a smaller reference (10% of domainMax) to keep indicators visible
  // since log scale compresses high values visually
  const indicatorScaleMax = isLog ? domainMax / 10 : domainSpan
  const indicatorRatio =
    indicatorScaleMax !== 0 ? height / 2 / indicatorScaleMax : 0

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  // Precompute for pixel coordinate calculation
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed

  // Simple arithmetic scale functions - avoid d3-scale overhead in hot path
  const toY = isLog
    ? (n: number) => height - (Math.log(n) / log2 - logMin) * logRatio + offset
    : (n: number) => height - (n - domainMin) * linearRatio + offset
  const toHeight = (n: number) => toY(originY) - toY(n)
  // Indicator scale is always linear, origin always 0
  const toHeight2 = (n: number) => n * indicatorRatio

  const { bases, softclip, hardclip, insertion } = theme.palette
  const totalColor = readConfObject(cfg, 'color') as string
  const colorMap: Record<string, string> = {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    insertion,
    softclip,
    hardclip,
    total: totalColor,
    mod_NONE: 'blue',
    cpg_meth: 'red',
    cpg_unmeth: 'blue',
  }

  // extraHorizontallyFlippedOffset is used to draw interbase items, which
  // are located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = reversed ? 1 / bpPerPx : 0

  // Flatbush clickmap data for interbase indicators
  const coords = [] as number[]
  const items = [] as InterbaseIndicatorItem[]

  const drawingModifications = colorBy.type === 'modifications'
  const drawingMethylation = colorBy.type === 'methylation'
  const isolatedModification = colorBy.modifications?.isolatedModification
  // Pre-create Set for O(1) simplex lookups during rendering
  const simplexSet = new Set(simplexModifications)

  // Keep track of previous total which we will use it to draw the interbase
  // indicator (if there is a sudden clip, there will be no read coverage but
  // there will be "clip" coverage) at that position beyond the read.
  //
  // if the clip is right at a block boundary then prevTotal will not be
  // available, so this is a best attempt to plot interbase indicator at the
  // "cliffs"
  let prevTotal = 0

  // Track for reducedFeatures collection (one feature per pixel)
  let prevReducedLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures: Feature[] = []
  const skipFeatures: Feature[] = []

  const lastTime = { time: Date.now() }
  let i = 0
  for (const feature of features.values()) {
    checkStopToken2(stopToken, i++, lastTime)
    if (feature.get('type') === 'skip') {
      skipFeatures.push(feature)
      continue
    }
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const leftPx = reversed
      ? (regionEnd - fend) / bpPerPx
      : (fstart - regionStart) / bpPerPx
    const rightPx = reversed
      ? (regionEnd - fstart) / bpPerPx
      : (fend - regionStart) / bpPerPx

    // Collect reducedFeatures (one per pixel) for tooltip functionality
    if (Math.floor(leftPx) !== Math.floor(prevReducedLeftPx)) {
      reducedFeatures.push(feature)
      prevReducedLeftPx = leftPx
    }

    const score0 = feature.get('score')
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin

    // Draw the gray background
    ctx.fillStyle = totalColor
    const bgWidth = rightPx - leftPx + fudgeFactor
    ctx.fillRect(leftPx, toY(score0), bgWidth, toHeight(score0))

    // Draw SNP data overlay
    const w = Math.max(rightPx - leftPx, 1)
    const h = toHeight(score0)
    const bottom = toY(score0) + h
    const roundedLeftPx = Math.round(leftPx)
    if (drawingModifications) {
      let curr = 0
      const refbase = snpinfo.refbase?.toUpperCase()
      const { nonmods, mods, snps, ref } = snpinfo
      for (const m of sortedKeysDesc(nonmods)) {
        const modKey = m.replace(/^(nonmod_|mod_)/, '')
        const mod = visibleModifications[modKey]
        if (!mod) {
          console.warn(`${m} not known yet`)
          continue
        }
        if (isolatedModification && mod.type !== isolatedModification) {
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

        const { entryDepth, avgProbability = 0 } = snpinfo.nonmods[m]!
        const modFraction = (modifiable / score0) * (entryDepth / detectable)

        ctx.fillStyle = alphaColor('blue', avgProbability)
        ctx.fillRect(
          roundedLeftPx,
          bottom - (curr + modFraction * h),
          w,
          modFraction * h,
        )
        curr += modFraction * h
      }
      for (const m of sortedKeysDesc(mods)) {
        const modKey = m.replace('mod_', '')
        const mod = visibleModifications[modKey]
        if (!mod) {
          console.warn(`${m} not known yet`)
          continue
        }
        if (isolatedModification && mod.type !== isolatedModification) {
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

        const { entryDepth, avgProbability = 0 } = mods[m]!
        const modFraction = (modifiable / score0) * (entryDepth / detectable)

        ctx.fillStyle = alphaColor(mod.color || 'black', avgProbability)
        ctx.fillRect(
          roundedLeftPx,
          bottom - (curr + modFraction * h),
          w,
          modFraction * h,
        )
        curr += modFraction * h
      }
    } else if (drawingMethylation) {
      const { depth, nonmods, mods } = snpinfo
      const curr = drawStackedBars(
        ctx,
        mods,
        colorMap,
        roundedLeftPx,
        bottom,
        w,
        h,
        depth,
        0,
      )
      drawStackedBars(
        ctx,
        nonmods,
        colorMap,
        roundedLeftPx,
        bottom,
        w,
        h,
        depth,
        curr,
      )
    } else {
      const { depth, snps } = snpinfo
      drawStackedBars(
        ctx,
        snps,
        colorMap,
        roundedLeftPx,
        bottom,
        w,
        h,
        depth,
        0,
      )
    }

    const noncov = snpinfo.noncov
    const interbaseEvents = Object.keys(noncov)
    if (interbaseEvents.length > 0) {
      const { maxBase } = findMaxBase(noncov)
      let totalCount = 0

      if (showInterbaseCounts) {
        const r = 0.6
        const x = leftPx - r + extraHorizontallyFlippedOffset
        let totalHeight = 0
        for (const base of interbaseEvents) {
          const entryDepth = noncov[base]!.entryDepth
          ctx.fillStyle = colorMap[base]!
          ctx.fillRect(
            x,
            INTERBASE_INDICATOR_HEIGHT + toHeight2(totalCount),
            r * 2,
            toHeight2(entryDepth),
          )
          totalHeight += toHeight2(entryDepth)
          totalCount += entryDepth
        }

        // Add to clickmap when zoomed in enough for meaningful interaction,
        // or when interbase events represent a significant fraction of reads
        const isMajorityInterbase =
          score0 > 0 && totalCount > score0 * indicatorThreshold
        if (bpPerPx < 50 || isMajorityInterbase) {
          const clickWidth = Math.max(r * 2, 1.5)
          coords.push(
            x,
            INTERBASE_INDICATOR_HEIGHT,
            x + clickWidth,
            INTERBASE_INDICATOR_HEIGHT + totalHeight,
          )
          items.push(
            createInterbaseItem(maxBase, totalCount, score0, noncov[maxBase]),
          )
        }
      } else {
        for (const base of interbaseEvents) {
          totalCount += noncov[base]!.entryDepth
        }
      }

      if (showInterbaseIndicators) {
        // avoid drawing a bunch of indicators if coverage is very low. note:
        // also uses the prev total in the case of the "cliff"
        const indicatorComparatorScore = Math.max(score0, prevTotal)
        if (
          totalCount > indicatorComparatorScore * indicatorThreshold &&
          indicatorComparatorScore > MINIMUM_INTERBASE_INDICATOR_READ_DEPTH
        ) {
          ctx.fillStyle = colorMap[maxBase]!
          ctx.beginPath()
          const l = leftPx + extraHorizontallyFlippedOffset
          ctx.moveTo(l - INTERBASE_INDICATOR_HALF_WIDTH, 0)
          ctx.lineTo(l + INTERBASE_INDICATOR_HALF_WIDTH, 0)
          ctx.lineTo(l, INTERBASE_INDICATOR_HEIGHT)
          ctx.fill()

          const hitboxPadding = 3
          coords.push(
            l - INTERBASE_INDICATOR_HALF_WIDTH - hitboxPadding,
            0,
            l + INTERBASE_INDICATOR_HALF_WIDTH + hitboxPadding,
            INTERBASE_INDICATOR_HEIGHT + hitboxPadding,
          )
          items.push(
            createInterbaseItem(
              maxBase,
              totalCount,
              indicatorComparatorScore,
              noncov[maxBase],
            ),
          )
        }
      }
    }
    prevTotal = score0
  }

  // Note: Arc rendering has been moved to LinearSNPCoverageDisplay component
  // to support cross-region arc connections. Skip features are still collected
  // and returned for the display to render.
  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(140,140,140,0.8)'
    for (const tick of ticks.values) {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    }
  }

  return {
    reducedFeatures,
    skipFeatures,
    coords,
    items,
  }
}

function buildClickMap(coords: number[], items: InterbaseIndicatorItem[]) {
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

export async function renderSNPCoverageToCanvas(
  props: RenderArgsDeserializedWithFeatures,
) {
  const { height, regions, bpPerPx } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const { reducedFeatures, skipFeatures, coords, items, ...rest } =
    await renderToAbstractCanvas(width, height, props, ctx =>
      makeImage(ctx, props),
    )

  const serialized = {
    ...rest,
    features: reducedFeatures.map(f => f.toJSON()),
    skipFeatures: skipFeatures.map(f => f.toJSON()),
    clickMap: buildClickMap(coords, items),
    height,
    width,
  }

  return rpcResult(serialized, collectTransferables(rest))
}
