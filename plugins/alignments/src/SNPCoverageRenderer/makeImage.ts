import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  bpSpanPx,
  featureSpanPx,
  forEachWithStopTokenCheck,
} from '@jbrowse/core/util'
import {
  YSCALEBAR_LABEL_OFFSET,
  getOrigin,
  getScale,
} from '@jbrowse/plugin-wiggle'

import { alphaColor } from '../shared/util'

import type { RenderArgsDeserializedWithFeatures } from './types'
import type { BaseCoverageBin } from '../shared/types'

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

// Regex patterns compiled once for performance
const NONMOD_MOD_PREFIX = /^(nonmod_|mod_)/
const MOD_PREFIX = /^mod_/

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

/**
 * Calculate modifiable and detectable counts for a modification following IGV's algorithm.
 *
 * @param params.base - The canonical base (e.g., 'A' for A+a modification)
 * @param params.isSimplex - Whether this modification is simplex (only on one strand)
 * @param params.refbase - The reference base at this position
 * @param params.snps - SNP counts at this position
 * @param params.ref - Reference match counts at this position
 * @param params.score0 - Total coverage at this position
 * @returns Object with modifiable and detectable counts
 */
function calculateModificationCounts({
  base,
  isSimplex,
  refbase,
  snps,
  ref,
  score0,
}: ModificationCountsParams): ModificationCountsResult {
  // Handle N base (all bases are modifiable/detectable)
  if (base === 'N') {
    return { modifiable: score0, detectable: score0 }
  }

  const cmp = complementBase[base as keyof typeof complementBase]

  // Calculate total reads for base and complement
  // IGV: getCount(pos, base) = reads matching that base (from SNPs or ref)
  const baseCount =
    (snps[base]?.entryDepth || 0) + (refbase === base ? ref.entryDepth : 0)
  const complCount =
    (snps[cmp]?.entryDepth || 0) + (refbase === cmp ? ref.entryDepth : 0)

  // Modifiable: reads that COULD have this modification (base or complement)
  // IGV: modifiable = getCount(pos, base) + getCount(pos, compl)
  const modifiable = baseCount + complCount

  // Detectable: reads where we can DETECT this modification
  // For simplex: only specific strands (+ for base, - for complement)
  // For duplex: all reads (same as modifiable)
  // IGV: detectable = simplex ? getPosCount(base) + getNegCount(compl) : modifiable
  const detectable = isSimplex
    ? (snps[base]?.['1'] || 0) +
      (snps[cmp]?.['-1'] || 0) +
      (refbase === base ? ref['1'] : 0) +
      (refbase === cmp ? ref['-1'] : 0)
    : modifiable

  return { modifiable, detectable }
}

export async function makeImage(
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
  } = props
  const theme = createJBrowseTheme(configTheme)
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
  // wiggle display, and makes the height of the actual drawn area add
  // "padding" to the top and bottom of the display
  const offset = YSCALEBAR_LABEL_OFFSET
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
  const originLinear = getOrigin('linear')

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showArcs = readConfObject(cfg, 'showArcs')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  // get the y coordinate that we are plotting at, this can be log scale
  const toY = (n: number) => height - (viewScale(n) || 0) + offset
  const toHeight = (n: number) => toY(originY) - toY(n)
  // used specifically for indicator
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

  // Use two pass rendering, which helps in visualizing the SNPs at higher
  // bpPerPx First pass: draw the gray background
  ctx.fillStyle = colorMap.total!
  forEachWithStopTokenCheck(
    features.values(),
    stopToken,
    function forEachSNPCov1(feature) {
      if (feature.get('type') === 'skip') {
        return
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score') as number
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
    },
  )

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

  const drawingModifications = colorBy.type === 'modifications'
  const drawingMethylation = colorBy.type === 'methylation'
  const isolatedModification = colorBy.modifications?.isolatedModification
  // Pre-create Set for O(1) simplex lookups during rendering
  const simplexSet = new Set(simplexModifications)

  // Second pass: draw the SNP data, and add a minimum feature width of 1px
  // which can be wider than the actual bpPerPx This reduces overdrawing of
  // the grey background over the SNPs
  forEachWithStopTokenCheck(
    features.values(),
    stopToken,
    function forEachSNPCov2(feature) {
      if (feature.get('type') === 'skip') {
        return
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const snpinfo = feature.get('snpinfo') as BaseCoverageBin
      const w = Math.max(rightPx - leftPx, 1)
      const score0 = feature.get('score')

      // Cache repeated calculations once per feature
      const height = toHeight(score0)
      const bottom = toY(score0) + height
      const leftPxRounded = Math.round(leftPx)

      if (drawingModifications) {
        let curr = 0
        const refbase = snpinfo.refbase?.toUpperCase()
        const { nonmods, mods, snps, ref } = snpinfo
        // Use pre-sorted keys from bin processing to avoid sorting on every render
        const nonmodKeys = (snpinfo as any).nonmodsSortedKeys || []
        for (const m of nonmodKeys) {
          const modKey = m.replace(NONMOD_MOD_PREFIX, '')
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

          const { entryDepth, avgProbability = 0 } = nonmods[m]!
          const modFraction = (modifiable / score0) * (entryDepth / detectable)
          const modFractionHeight = modFraction * height

          ctx.fillStyle = alphaColor('blue', avgProbability)
          ctx.fillRect(
            leftPxRounded,
            bottom - (curr + modFractionHeight),
            w,
            modFractionHeight,
          )
          curr += modFractionHeight
        }
        const modKeys = (snpinfo as any).modsSortedKeys || []
        for (const m of modKeys) {
          const modKey = m.replace(MOD_PREFIX, '')
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
          const modFractionHeight = modFraction * height

          ctx.fillStyle = alphaColor(mod.color || 'black', avgProbability)
          ctx.fillRect(
            leftPxRounded,
            bottom - (curr + modFractionHeight),
            w,
            modFractionHeight,
          )
          curr += modFractionHeight
        }
      } else if (drawingMethylation) {
        const { depth, nonmods, mods } = snpinfo
        const depthInv = 1 / depth
        let curr = 0

        const modKeys = (snpinfo as any).modsSortedKeys || []
        for (const base of modKeys) {
          const { entryDepth } = mods[base]!
          const fraction = entryDepth * depthInv
          ctx.fillStyle = colorMap[base] || 'black'
          ctx.fillRect(
            leftPxRounded,
            bottom - (entryDepth + curr) * depthInv * height,
            w,
            fraction * height,
          )
          curr += entryDepth
        }
        const nonmodKeys = (snpinfo as any).nonmodsSortedKeys || []
        for (const base of nonmodKeys) {
          const { entryDepth } = nonmods[base]!
          const fraction = entryDepth * depthInv
          ctx.fillStyle = colorMap[base] || 'black'
          ctx.fillRect(
            leftPxRounded,
            bottom - (entryDepth + curr) * depthInv * height,
            w,
            fraction * height,
          )
          curr += entryDepth
        }
      } else {
        const { depth, snps } = snpinfo
        const depthInv = 1 / depth
        let curr = 0
        // Use pre-sorted keys - this is the hot path for common SNP rendering
        const snpKeys = (snpinfo as any).snpsSortedKeys || []
        for (const base of snpKeys) {
          const { entryDepth } = snps[base]!
          const fraction = entryDepth * depthInv
          ctx.fillStyle = colorMap[base] || 'black'
          ctx.fillRect(
            leftPxRounded,
            bottom - (entryDepth + curr) * depthInv * height,
            w,
            fraction * height,
          )
          curr += entryDepth
        }
      }

      const interbaseEvents = Object.keys(snpinfo.noncov)
      if (showInterbaseCounts) {
        let curr = 0
        for (const base of interbaseEvents) {
          const { entryDepth } = snpinfo.noncov[base]!
          const r = 0.6
          ctx.fillStyle = colorMap[base]!
          ctx.fillRect(
            leftPx - r + extraHorizontallyFlippedOffset,
            INTERBASE_INDICATOR_HEIGHT + toHeight2(curr),
            r * 2,
            toHeight2(entryDepth),
          )
          curr += entryDepth
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
        }
      }
      prevTotal = score0
    },
  )

  if (showArcs) {
    forEachWithStopTokenCheck(
      features.values(),
      stopToken,
      function forEachSNPCov3(feature) {
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
      },
    )
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
}
