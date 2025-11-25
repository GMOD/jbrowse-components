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
import { getAvgProbability } from '../SNPCoverageAdapter/util'
import {
  CAT_MOD,
  CAT_NONCOV,
  CAT_NONMOD,
  CAT_SNP,
  ENTRY_DEPTH,
  ENTRY_NEG,
  ENTRY_POS,
} from '../shared/types'

import type { RenderArgsDeserializedWithFeatures } from './types'
import type { FlatBaseCoverageBin } from '../shared/types'

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

interface ModificationCountsParams {
  readonly base: string
  readonly isSimplex: boolean
  readonly refbase: string | undefined
  readonly snpinfo: FlatBaseCoverageBin
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
  snpinfo,
  score0,
}: ModificationCountsParams): ModificationCountsResult {
  if (base === 'N') {
    return { modifiable: score0, detectable: score0 }
  }

  const cmp = complementBase[base as keyof typeof complementBase]
  const entries = snpinfo.entries

  // Get SNP entry for base and complement
  const baseEntry = entries.get(CAT_SNP + base)
  const cmpEntry = entries.get(CAT_SNP + cmp)

  // Calculate total reads for base and complement
  const baseCount =
    (baseEntry?.[ENTRY_DEPTH] || 0) +
    (refbase === base ? snpinfo.refDepth : 0)
  const complCount =
    (cmpEntry?.[ENTRY_DEPTH] || 0) + (refbase === cmp ? snpinfo.refDepth : 0)

  const modifiable = baseCount + complCount

  const detectable = isSimplex
    ? (baseEntry?.[ENTRY_POS] || 0) +
      (cmpEntry?.[ENTRY_NEG] || 0) +
      (refbase === base ? snpinfo.refPos : 0) +
      (refbase === cmp ? snpinfo.refNeg : 0)
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

  // Precompute origin scaled values to avoid redundant calls in toHeight/toHeight2
  const originYScaled = viewScale(getOrigin(scaleOpts.scaleType)) || 0
  const originLinearScaled = indicatorViewScale(getOrigin('linear')) || 0

  const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
  const showInterbaseCounts = readConfObject(cfg, 'showInterbaseCounts')
  const showArcs = readConfObject(cfg, 'showArcs')
  const showInterbaseIndicators = readConfObject(cfg, 'showInterbaseIndicators')

  // get the y coordinate that we are plotting at, this can be log scale
  const toY = (n: number) => height - (viewScale(n) || 0) + offset
  // toHeight simplified: toY(origin) - toY(n) = viewScale(n) - viewScale(origin)
  const toHeight = (n: number) => (viewScale(n) || 0) - originYScaled
  // used specifically for indicator
  const toY2 = (n: number) => height - (indicatorViewScale(n) || 0) + offset
  const toHeight2 = (n: number) => (indicatorViewScale(n) || 0) - originLinearScaled

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
    const score = feature.get('score')
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
    const snpinfo = feature.get('snpinfo') as FlatBaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const entries = snpinfo.entries

    if (drawingModifications) {
      let curr = 0
      const refbase = snpinfo.refbase?.toUpperCase()

      // Get nonmod entries (keys starting with CAT_NONMOD)
      const nonmodEntries: [string, Uint32Array][] = []
      const modEntries: [string, Uint32Array][] = []
      for (const [key, entry] of entries) {
        if (key.startsWith(CAT_NONMOD)) {
          nonmodEntries.push([key.slice(CAT_NONMOD.length), entry])
        } else if (key.startsWith(CAT_MOD)) {
          modEntries.push([key.slice(CAT_MOD.length), entry])
        }
      }
      nonmodEntries.sort((a, b) => b[0].localeCompare(a[0]))
      modEntries.sort((a, b) => b[0].localeCompare(a[0]))

      for (const [modType, entry] of nonmodEntries) {
        const mod = visibleModifications[modType]
        if (!mod) {
          console.warn(`${modType} not known yet`)
          continue
        }
        if (isolatedModification && mod.type !== isolatedModification) {
          continue
        }
        const { modifiable, detectable } = calculateModificationCounts({
          base: mod.base,
          isSimplex: simplexSet.has(mod.type),
          refbase,
          snpinfo,
          score0,
        })

        const entryDepth = entry[ENTRY_DEPTH]!
        const avgProbability = getAvgProbability(entry)
        const modFraction = (modifiable / score0) * (entryDepth / detectable)
        const c = alphaColor('blue', avgProbability)
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

      for (const [modType, entry] of modEntries) {
        const mod = visibleModifications[modType]
        if (!mod) {
          console.warn(`${modType} not known yet`)
          continue
        }
        if (isolatedModification && mod.type !== isolatedModification) {
          continue
        }
        const { modifiable, detectable } = calculateModificationCounts({
          base: mod.base,
          isSimplex: simplexSet.has(mod.type),
          refbase,
          snpinfo,
          score0,
        })

        const entryDepth = entry[ENTRY_DEPTH]!
        const avgProbability = getAvgProbability(entry)
        const modFraction = (modifiable / score0) * (entryDepth / detectable)
        const c = alphaColor(mod.color || 'black', avgProbability)
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
      const depth = snpinfo.depth
      let curr = 0

      // Get mod and nonmod entries
      const modEntries: [string, Uint32Array][] = []
      const nonmodEntries: [string, Uint32Array][] = []
      for (const [key, entry] of entries) {
        if (key.startsWith(CAT_MOD)) {
          modEntries.push([key.slice(CAT_MOD.length), entry])
        } else if (key.startsWith(CAT_NONMOD)) {
          nonmodEntries.push([key.slice(CAT_NONMOD.length), entry])
        }
      }
      modEntries.sort((a, b) => b[0].localeCompare(a[0]))
      nonmodEntries.sort((a, b) => b[0].localeCompare(a[0]))

      for (const [base, entry] of modEntries) {
        const entryDepth = entry[ENTRY_DEPTH]!
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
      for (const [base, entry] of nonmodEntries) {
        const entryDepth = entry[ENTRY_DEPTH]!
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
      const depth = snpinfo.depth
      let curr = 0

      // Get SNP entries
      const snpEntries: [string, Uint32Array][] = []
      for (const [key, entry] of entries) {
        if (key.startsWith(CAT_SNP)) {
          snpEntries.push([key.slice(CAT_SNP.length), entry])
        }
      }
      snpEntries.sort((a, b) => b[0].localeCompare(a[0]))

      for (const [base, entry] of snpEntries) {
        const entryDepth = entry[ENTRY_DEPTH]!
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
    }

    // Get noncov entries for interbase indicators
    const noncovEntries: [string, Uint32Array][] = []
    for (const [key, entry] of entries) {
      if (key.startsWith(CAT_NONCOV)) {
        noncovEntries.push([key.slice(CAT_NONCOV.length), entry])
      }
    }

    if (showInterbaseCounts) {
      let curr = 0
      for (const [base, entry] of noncovEntries) {
        const entryDepth = entry[ENTRY_DEPTH]!
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
      for (const [base, entry] of noncovEntries) {
        const entryDepth = entry[ENTRY_DEPTH]!
        accum += entryDepth
        if (entryDepth > max) {
          max = entryDepth
          maxBase = base
        }
      }

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
}
