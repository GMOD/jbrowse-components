import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  featureSpanPx,
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
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

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

const fudgeFactor = 0.6

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

  const opts = { ...scaleOpts, range: [0, height] }
  const viewScale = getScale(opts)

  // clipping and insertion indicators, uses a smaller height/2 scale
  const indicatorViewScale = getScale({
    ...opts,
    range: [0, height / 2],
    scaleType: 'linear',
  })
  const originY = getOrigin(scaleOpts.scaleType)

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  // get the y coordinate that we are plotting at, this can be log scale
  const toY = (n: number) => height - (viewScale(n) || 0) + offset
  const toHeight = (n: number) => toY(originY) - toY(n)
  // used specifically for indicator, origin is always 0 for linear scale
  const toY2 = (n: number) => height - (indicatorViewScale(n) || 0) + offset
  const toHeight2 = (n: number) => toY2(0) - toY2(n)

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

  // Use two pass rendering, which helps in visualizing the SNPs at higher
  // bpPerPx First pass: draw the gray background
  ctx.fillStyle = colorMap.total!
  forEachWithStopTokenCheck(features.values(), stopToken, feature => {
    if (feature.get('type') === 'skip') {
      return
    }
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const w = rightPx - leftPx + fudgeFactor
    const score = feature.get('score') as number
    ctx.fillRect(leftPx, toY(score), w, toHeight(score))
  })

  // Keep track of previous total which we will use it to draw the interbase
  // indicator (if there is a sudden clip, there will be no read coverage but
  // there will be "clip" coverage) at that position beyond the read.
  //
  // if the clip is right at a block boundary then prevTotal will not be
  // available, so this is a best attempt to plot interbase indicator at the
  // "cliffs"
  let prevTotal = 0

  // extraHorizontallyFlippedOffset is used to draw interbase items, which
  // are located to the left when forward and right when reversed
  const extraHorizontallyFlippedOffset = region.reversed ? 1 / bpPerPx : 0

  // Flatbush clickmap data for interbase indicators
  const coords = [] as number[]
  const items = [] as InterbaseIndicatorItem[]
  let lastInterbaseCountX = Number.NEGATIVE_INFINITY

  const drawingModifications = colorBy.type === 'modifications'
  const drawingMethylation = colorBy.type === 'methylation'
  const isolatedModification = colorBy.modifications?.isolatedModification
  // Pre-create Set for O(1) simplex lookups during rendering
  const simplexSet = new Set(simplexModifications)

  // Second pass: draw the SNP data, and add a minimum feature width of 1px
  // which can be wider than the actual bpPerPx This reduces overdrawing of
  // the grey background over the SNPs
  forEachWithStopTokenCheck(features.values(), stopToken, feature => {
    if (feature.get('type') === 'skip') {
      return
    }
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const h = toHeight(score0)
    const bottom = toY(score0) + h
    if (drawingModifications) {
      let curr = 0
      const refbase = snpinfo.refbase?.toUpperCase()
      const { nonmods, mods, snps, ref } = snpinfo
      // Sort keys once outside the loop
      const nonmodKeys = Object.keys(nonmods).sort().reverse()
      for (const m of nonmodKeys) {
        // Remove prefix once for lookup
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
        const c = alphaColor('blue', avgProbability)

        ctx.fillStyle = c
        ctx.fillRect(
          Math.round(leftPx),
          bottom - (curr + modFraction * h),
          w,
          modFraction * h,
        )
        curr += modFraction * h
      }
      // Sort keys once outside the loop
      const modKeys = Object.keys(mods).sort().reverse()
      for (const m of modKeys) {
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
        const c = alphaColor(mod.color || 'black', avgProbability)

        ctx.fillStyle = c
        ctx.fillRect(
          Math.round(leftPx),
          bottom - (curr + modFraction * h),
          w,
          modFraction * h,
        )
        curr += modFraction * h
      }
    } else if (drawingMethylation) {
      const { depth, nonmods, mods } = snpinfo
      let curr = 0

      for (const base of Object.keys(mods).sort().reverse()) {
        const { entryDepth } = mods[base]!
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(
          Math.round(leftPx),
          bottom - ((entryDepth + curr) / depth) * h,
          w,
          (entryDepth / depth) * h,
        )
        curr += entryDepth
      }
      for (const base of Object.keys(nonmods).sort().reverse()) {
        const { entryDepth } = nonmods[base]!
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(
          Math.round(leftPx),
          bottom - ((entryDepth + curr) / depth) * h,
          w,
          (entryDepth / depth) * h,
        )
        curr += entryDepth
      }
    } else {
      const { depth, snps } = snpinfo
      let curr = 0
      for (const base of Object.keys(snps).sort().reverse()) {
        const { entryDepth } = snps[base]!
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(
          Math.round(leftPx),
          bottom - ((entryDepth + curr) / depth) * h,
          w,
          (entryDepth / depth) * h,
        )
        curr += entryDepth
      }
    }

    const interbaseEvents = Object.keys(snpinfo.noncov)
    if (showInterbaseCounts) {
      let curr = 0
      const r = 0.6
      const x = leftPx - r + extraHorizontallyFlippedOffset
      let totalHeight = 0
      for (const base of interbaseEvents) {
        const { entryDepth } = snpinfo.noncov[base]!
        ctx.fillStyle = colorMap[base]!
        ctx.fillRect(
          x,
          INTERBASE_INDICATOR_HEIGHT + toHeight2(curr),
          r * 2,
          toHeight2(entryDepth),
        )
        totalHeight += toHeight2(entryDepth)
        curr += entryDepth
      }

      // Add to clickmap if more than 0.5px from last added
      if (interbaseEvents.length > 0 && x - lastInterbaseCountX > 0.5) {
        const maxBase = interbaseEvents.reduce((a, b) =>
          (snpinfo.noncov[a]?.entryDepth ?? 0) >
          (snpinfo.noncov[b]?.entryDepth ?? 0)
            ? a
            : b,
        )
        coords.push(
          x,
          INTERBASE_INDICATOR_HEIGHT,
          x + r * 2,
          INTERBASE_INDICATOR_HEIGHT + totalHeight,
        )
        items.push({
          type: maxBase as 'insertion' | 'softclip' | 'hardclip',
          base: maxBase,
          count: curr,
          total: score0,
        })
        lastInterbaseCountX = x
      }
    }

    if (showInterbaseIndicators) {
      let accum = 0
      let max = 0
      let maxBase = ''
      for (const base of interbaseEvents) {
        const { entryDepth } = snpinfo.noncov[base]!
        accum += entryDepth
        if (entryDepth > max) {
          max = entryDepth
          maxBase = base
        }
      }

      // avoid drawing a bunch of indicators if coverage is very low. note:
      // also uses the prev total in the case of the "cliff"
      const indicatorComparatorScore = Math.max(score0, prevTotal)
      if (
        accum > indicatorComparatorScore * indicatorThreshold &&
        indicatorComparatorScore > MINIMUM_INTERBASE_INDICATOR_READ_DEPTH
      ) {
        ctx.fillStyle = colorMap[maxBase]!
        ctx.beginPath()
        const l = leftPx + extraHorizontallyFlippedOffset
        ctx.moveTo(l - INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l + INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l, INTERBASE_INDICATOR_HEIGHT)
        ctx.fill()

        // Add to Flatbush clickmap
        coords.push(
          l - INTERBASE_INDICATOR_WIDTH / 2,
          0,
          l + INTERBASE_INDICATOR_WIDTH / 2,
          INTERBASE_INDICATOR_HEIGHT,
        )
        items.push({
          type: maxBase as 'insertion' | 'softclip' | 'hardclip',
          base: maxBase,
          count: accum,
          total: indicatorComparatorScore,
        })
      }
    }
    prevTotal = score0
  })

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

  // Return reducedFeatures for tooltip functionality
  // Create reduced features, keeping only one feature per pixel to avoid
  // serializing thousands of per-base features
  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures: Feature[] = []
  const skipFeatures: Feature[] = []
  for (const feature of features.values()) {
    if (feature.get('type') === 'skip') {
      skipFeatures.push(feature)
      continue
    }
    const start = feature.get('start')
    const leftPx = (start - region.start) / bpPerPx
    // Only keep one feature per pixel
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
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
