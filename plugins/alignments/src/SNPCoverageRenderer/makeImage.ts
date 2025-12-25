import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  bpSpanPx,
  featureSpanPx,
  forEachWithStopTokenCheck,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import {
  YSCALEBAR_LABEL_OFFSET,
  getOrigin,
  getScale,
} from '@jbrowse/plugin-wiggle'
import { rpcResult } from 'librpc-web-mod'

import { alphaColor } from '../shared/util'

import type {
  ClickMapItem,
  InterbaseIndicatorItem,
  RenderArgsDeserializedWithFeatures,
  SNPItem,
} from './types'
import type { BaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

// width/height of the triangle above e.g. insertion indicators
const INTERBASE_INDICATOR_WIDTH = 7
const INTERBASE_INDICATOR_HEIGHT = 4.5

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

const complementBase = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
} as const

const fudgeFactor = 0.6

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

interface ReducedFeature {
  uniqueId: string
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

export async function renderSNPCoverageToCanvas(
  props: RenderArgsDeserializedWithFeatures,
) {
  const { features, regions, bpPerPx, adapterConfig } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const height = props.height
  const adapterId = adapterConfig.adapterId ?? 'unknown'

  // Separate skip features from coverage features
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

  const { reducedFeatures, coords, items, ...rest } = await renderToAbstractCanvas(
    width,
    height,
    props,
    ctx => drawSNPCoverage(ctx, props, coverageFeatures),
  )

  const serialized = {
    ...rest,
    features: (reducedFeatures as ReducedFeature[]).map((f, idx) => ({
      ...f,
      uniqueId: `${adapterId}-${f.start}-${idx}`,
    })),
    skipFeatures,
    clickMap: buildClickMap(coords as number[], items as ClickMapItem[]),
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
  const originLinear = getOrigin('linear')

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showArcs = readConfObject(cfg, 'showArcs')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  const toY = (n: number) => height - (viewScale(n) || 0) + offset
  const toHeight = (n: number) => toY(originY) - toY(n)
  const toY2 = (n: number) => height - (indicatorViewScale(n) || 0) + offset
  const toHeight2 = (n: number) => toY2(originLinear) - toY2(n)

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

  // Collect reduced features for serialization (one per pixel)
  const reducedFeatures: ReducedFeature[] = []
  let prevReducedLeftPx = Number.NEGATIVE_INFINITY

  // Collect clickMap data
  const coords: number[] = []
  const items: ClickMapItem[] = []

  // First pass: draw the gray background
  ctx.fillStyle = colorMap.total!
  forEachWithStopTokenCheck(coverageFeatures, stopToken, feature => {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const w = rightPx - leftPx + fudgeFactor
    const score = feature.get('score') as number
    ctx.fillRect(leftPx, toY(score), w, toHeight(score))

    // Collect one feature per pixel for reduced features
    if (leftPx > prevReducedLeftPx + 1) {
      reducedFeatures.push({
        uniqueId: feature.id(),
        start: feature.get('start'),
        end: feature.get('end'),
        score,
        snpinfo: feature.get('snpinfo'),
        refName: region.refName,
      })
      prevReducedLeftPx = leftPx
    }
  })

  let prevTotal = 0
  const extraHorizontallyFlippedOffset = region.reversed ? 1 / bpPerPx : 0

  const drawingModifications = colorBy.type === 'modifications'
  const drawingMethylation = colorBy.type === 'methylation'
  const isolatedModification = colorBy.modifications?.isolatedModification
  const simplexSet = new Set(simplexModifications)

  // Second pass: draw the SNP data
  forEachWithStopTokenCheck(coverageFeatures, stopToken, feature => {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')

    if (drawingModifications) {
      let curr = 0
      const refbase = snpinfo.refbase?.toUpperCase()
      const { nonmods, mods, snps, ref } = snpinfo
      const nonmodKeys = Object.keys(nonmods).sort().reverse()
      for (const m of nonmodKeys) {
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
        const nonModColor = 'blue'
        const c = alphaColor(nonModColor, avgProbability)
        const h = toHeight(score0)
        const bottom = toY(score0) + h

        ctx.fillStyle = c
        ctx.fillRect(
          Math.round(leftPx),
          bottom - (curr + modFraction * h),
          w,
          modFraction * h,
        )
        curr += modFraction * h
      }
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
        const baseColor = mod.color || 'black'
        const c = alphaColor(baseColor, avgProbability)
        const h = toHeight(score0)
        const bottom = toY(score0) + h

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
        const h = toHeight(score0)
        const bottom = toY(score0) + h
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
        const h = toHeight(score0)
        const bottom = toY(score0) + h
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
      const { depth, snps, refbase } = snpinfo
      let curr = 0
      for (const base of Object.keys(snps).sort().reverse()) {
        const entry = snps[base]!
        const { entryDepth } = entry
        const h = toHeight(score0)
        const bottom = toY(score0) + h
        const y1 = bottom - ((entryDepth + curr) / depth) * h
        const barHeight = (entryDepth / depth) * h
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(Math.round(leftPx), y1, w, barHeight)

        // Add to clickMap if significant (>4% of reads)
        const frequency = entryDepth / score0
        if (frequency >= 0.04) {
          coords.push(Math.round(leftPx), y1, Math.round(leftPx) + w, y1 + barHeight)
          const snpItem: SNPItem = {
            type: 'snp',
            base,
            count: entryDepth,
            total: score0,
            refbase: refbase?.toUpperCase(),
            avgQual: entry.avgProbability,
            fwdCount: entry['1'] || 0,
            revCount: entry['-1'] || 0,
            bin: snpinfo,
            start: feature.get('start'),
            end: feature.get('end'),
          }
          items.push(snpItem)
        }
        curr += entryDepth
      }
    }

    const interbaseEvents = Object.keys(snpinfo.noncov)
    if (interbaseEvents.length > 0) {
      let totalCount = 0
      let max = 0
      let maxBase = ''
      for (const base of interbaseEvents) {
        const { entryDepth } = snpinfo.noncov[base]!
        totalCount += entryDepth
        if (entryDepth > max) {
          max = entryDepth
          maxBase = base
        }
      }

      const fstart = feature.get('start')
      const maxEntry = snpinfo.noncov[maxBase]

      if (showInterbaseCounts) {
        const r = 0.6
        const x = leftPx - r + extraHorizontallyFlippedOffset
        let currHeight = 0
        let totalHeight = 0
        for (const base of interbaseEvents) {
          const { entryDepth } = snpinfo.noncov[base]!
          const barHeight = toHeight2(entryDepth)
          ctx.fillStyle = colorMap[base]!
          ctx.fillRect(x, INTERBASE_INDICATOR_HEIGHT + currHeight, r * 2, barHeight)
          currHeight += barHeight
          totalHeight += barHeight
        }

        // Add to clickmap when zoomed in or when significant
        const isMajorityInterbase = score0 > 0 && totalCount > score0 * indicatorThreshold
        if (bpPerPx < 50 || isMajorityInterbase) {
          const clickWidth = Math.max(r * 2, 4)
          coords.push(x, INTERBASE_INDICATOR_HEIGHT, x + clickWidth, INTERBASE_INDICATOR_HEIGHT + totalHeight)
          const interbaseItem: InterbaseIndicatorItem = {
            type: maxBase as 'insertion' | 'softclip' | 'hardclip',
            base: maxBase,
            count: totalCount,
            total: score0,
            avgLength: maxEntry?.avgLength,
            minLength: maxEntry?.minLength,
            maxLength: maxEntry?.maxLength,
            topSequence: maxEntry?.topSequence,
            start: fstart,
          }
          items.push(interbaseItem)
        }
      }

      if (showInterbaseIndicators) {
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

          // Add triangle to clickmap
          const hitboxPadding = 3
          coords.push(
            l - INTERBASE_INDICATOR_WIDTH / 2 - hitboxPadding,
            0,
            l + INTERBASE_INDICATOR_WIDTH / 2 + hitboxPadding,
            INTERBASE_INDICATOR_HEIGHT + hitboxPadding,
          )
          const interbaseItem: InterbaseIndicatorItem = {
            type: maxBase as 'insertion' | 'softclip' | 'hardclip',
            base: maxBase,
            count: totalCount,
            total: indicatorComparatorScore,
            avgLength: maxEntry?.avgLength,
            minLength: maxEntry?.minLength,
            maxLength: maxEntry?.maxLength,
            topSequence: maxEntry?.topSequence,
            start: fstart,
          }
          items.push(interbaseItem)
        }
      }
    }
    prevTotal = score0
  })

  if (showArcs) {
    forEachWithStopTokenCheck(features.values(), stopToken, feature => {
      if (feature.get('type') !== 'skip') {
        return
      }
      const s = feature.get('start')
      const e = feature.get('end')
      const [left, right] = bpSpanPx(s, e, region, bpPerPx)

      ctx.beginPath()
      const effectiveStrand = feature.get('effectiveStrand')
      const pos = 'rgba(255,200,200,0.7)'
      const neg = 'rgba(200,200,255,0.7)'
      const neutral = 'rgba(200,200,200,0.7)'

      if (effectiveStrand === 1) {
        ctx.strokeStyle = pos
      } else if (effectiveStrand === -1) {
        ctx.strokeStyle = neg
      } else {
        ctx.strokeStyle = neutral
      }

      ctx.lineWidth = Math.log(feature.get('score') + 1)
      ctx.moveTo(left, height - offset * 2)
      ctx.bezierCurveTo(left, 0, right, 0, right, height - offset * 2)
      ctx.stroke()
    })
  }

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

  return { reducedFeatures, coords, items }
}
