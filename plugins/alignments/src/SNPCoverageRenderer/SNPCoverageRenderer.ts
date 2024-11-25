import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { featureSpanPx, bpSpanPx } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import {
  getOrigin,
  getScale,
  WiggleBaseRenderer,
  YSCALEBAR_LABEL_OFFSET,
} from '@jbrowse/plugin-wiggle'
import { alphaColor } from '../shared/util'
import type {
  BaseCoverageBin,
  ModificationTypeWithColor,
} from '../shared/types'
import type { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ScaleOpts } from '@jbrowse/plugin-wiggle'

// locals

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
}

// width/height of the triangle above e.g. insertion indicators
const INTERBASE_INDICATOR_WIDTH = 7
const INTERBASE_INDICATOR_HEIGHT = 4.5

// minimum read depth to draw the insertion indicators, below this the
// 'statistical significance' is low
const MINIMUM_INTERBASE_INDICATOR_READ_DEPTH = 7

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  ticks: { values: number[] }
  displayCrossHatches: boolean
  visibleModifications?: Record<string, ModificationTypeWithColor>
}

const complementBase = {
  C: 'G',
  G: 'C',
  A: 'T',
  T: 'A',
}

const fudgeFactor = 0.6

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  async draw(
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
    const drawInterbaseCounts = readConfObject(cfg, 'drawInterbaseCounts')
    const drawArcs = readConfObject(cfg, 'drawArcs')
    const drawIndicators = readConfObject(cfg, 'drawIndicators')

    // get the y coordinate that we are plotting at, this can be log scale
    const toY = (n: number) => height - (viewScale(n) || 0) + offset
    const toHeight = (n: number) => toY(originY) - toY(n)
    // used specifically for indicator
    const toY2 = (n: number) => height - (indicatorViewScale(n) || 0) + offset
    const toHeight2 = (n: number) => toY2(originLinear) - toY2(n)

    const { bases } = theme.palette
    const colorForBase: Record<string, string> = {
      A: bases.A.main,
      C: bases.C.main,
      G: bases.G.main,
      T: bases.T.main,
      insertion: 'purple',
      softclip: 'blue',
      hardclip: 'red',
      total: readConfObject(cfg, 'color'),
      mod_NONE: 'blue',
      cpg_meth: 'red',
      cpg_unmeth: 'blue',
    }

    const feats = [...features.values()]

    // Use two pass rendering, which helps in visualizing the SNPs at higher
    // bpPerPx First pass: draw the gray background
    ctx.fillStyle = colorForBase.total!
    let start = performance.now()
    for (const feature of feats) {
      if (feature.get('type') === 'skip') {
        continue
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score') as number
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
    }

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

    // @ts-expect-error
    const drawingModifications = colorBy?.type === 'modifications'
    // @ts-expect-error
    const drawingMethylation = colorBy?.type === 'methylation'
    const isolatedModification =
      // @ts-expect-error
      colorBy?.modifications?.isolatedModification

    // Second pass: draw the SNP data, and add a minimum feature width of 1px
    // which can be wider than the actual bpPerPx This reduces overdrawing of
    // the grey background over the SNPs
    start = performance.now()
    for (const feature of feats) {
      const now = performance.now()
      if (now - start > 400) {
        checkStopToken(stopToken)
      }
      if (feature.get('type') === 'skip') {
        continue
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const snpinfo = feature.get('snpinfo') as BaseCoverageBin
      const w = Math.max(rightPx - leftPx, 1)
      const score0 = feature.get('score')
      if (drawingModifications) {
        let curr = 0
        const refbase = snpinfo.refbase?.toUpperCase()
        const { nonmods, mods, snps, ref } = snpinfo
        for (const m of Object.keys(nonmods).sort().reverse()) {
          const mod =
            visibleModifications[m.replace('nonmod_', '')] ||
            visibleModifications[m.replace('mod_', '')]
          if (!mod) {
            console.warn(`${m} not known yet`)
            continue
          }
          if (isolatedModification && mod.type !== isolatedModification) {
            continue
          }
          const cmp = complementBase[mod.base as keyof typeof complementBase]

          // this approach is inspired from the 'simplex' approach in igv
          // https://github.com/igvteam/igv/blob/af07c3b1be8806cfd77343ee04982aeff17d2beb/src/main/java/org/broad/igv/sam/mods/BaseModificationCoverageRenderer.java#L51
          const detectable =
            mod.base === 'N'
              ? score0
              : (snps[mod.base]?.entryDepth || 0) +
                (snps[cmp]?.entryDepth || 0) +
                (refbase === mod.base ? ref['1'] : 0) +
                (refbase === cmp ? ref['-1'] : 0)

          const modifiable =
            mod.base === 'N'
              ? score0
              : (snps[mod.base]?.entryDepth || 0) +
                (snps[cmp]?.entryDepth || 0) +
                (refbase === mod.base ? ref.entryDepth : 0) +
                (refbase === cmp ? ref.entryDepth : 0)

          const { entryDepth, avgProbability = 0 } = snpinfo.nonmods[m]!
          const modFraction = (modifiable / score0) * (entryDepth / detectable)
          const nonModColor = 'blue'
          const c = alphaColor(nonModColor, avgProbability)
          const height = toHeight(score0)
          const bottom = toY(score0) + height

          ctx.fillStyle = c
          ctx.fillRect(
            Math.round(leftPx),
            bottom - (curr + modFraction * height),
            w,
            modFraction * height,
          )
          curr += modFraction * height
        }
        for (const m of Object.keys(mods).sort().reverse()) {
          const mod = visibleModifications[m.replace('mod_', '')]
          if (!mod) {
            console.warn(`${m} not known yet`)
            continue
          }
          if (isolatedModification && mod.type !== isolatedModification) {
            continue
          }
          const cmp = complementBase[mod.base as keyof typeof complementBase]

          // this approach is inspired from the 'simplex' approach in igv
          // https://github.com/igvteam/igv/blob/af07c3b1be8806cfd77343ee04982aeff17d2beb/src/main/java/org/broad/igv/sam/mods/BaseModificationCoverageRenderer.java#L51
          const detectable =
            mod.base === 'N'
              ? score0
              : (snps[mod.base]?.entryDepth || 0) +
                (snps[cmp]?.entryDepth || 0) +
                (refbase === mod.base ? ref['1'] : 0) +
                (refbase === cmp ? ref['-1'] : 0)

          const modifiable =
            mod.base === 'N'
              ? score0
              : (snps[mod.base]?.entryDepth || 0) +
                (snps[cmp]?.entryDepth || 0) +
                (refbase === mod.base ? ref.entryDepth : 0) +
                (refbase === cmp ? ref.entryDepth : 0)

          const { entryDepth, avgProbability = 0 } = mods[m]!
          const modFraction = (modifiable / score0) * (entryDepth / detectable)
          const baseColor = mod.color || 'black'
          const c = alphaColor(baseColor, avgProbability)
          const height = toHeight(score0)
          const bottom = toY(score0) + height

          ctx.fillStyle = c
          ctx.fillRect(
            Math.round(leftPx),
            bottom - (curr + modFraction * height),
            w,
            modFraction * height,
          )
          curr += modFraction * height
        }
      } else if (drawingMethylation) {
        const { depth, nonmods, mods } = snpinfo
        let curr = 0

        for (const base of Object.keys(mods).sort().reverse()) {
          const { entryDepth } = mods[base]!
          const height = toHeight(score0)
          const bottom = toY(score0) + height
          ctx.fillStyle = colorForBase[base] || 'black'
          ctx.fillRect(
            Math.round(leftPx),
            bottom - ((entryDepth + curr) / depth) * height,
            w,
            (entryDepth / depth) * height,
          )
          curr += entryDepth
        }
        for (const base of Object.keys(nonmods).sort().reverse()) {
          const { entryDepth } = nonmods[base]!
          const height = toHeight(score0)
          const bottom = toY(score0) + height
          ctx.fillStyle = colorForBase[base] || 'black'
          ctx.fillRect(
            Math.round(leftPx),
            bottom - ((entryDepth + curr) / depth) * height,
            w,
            (entryDepth / depth) * height,
          )
          curr += entryDepth
        }
      } else {
        const { depth, snps } = snpinfo
        let curr = 0
        for (const base of Object.keys(snps).sort().reverse()) {
          const { entryDepth } = snps[base]!
          const height = toHeight(score0)
          const bottom = toY(score0) + height
          ctx.fillStyle = colorForBase[base] || 'black'
          ctx.fillRect(
            Math.round(leftPx),
            bottom - ((entryDepth + curr) / depth) * height,
            w,
            (entryDepth / depth) * height,
          )
          curr += entryDepth
        }
      }

      const interbaseEvents = Object.keys(snpinfo.noncov)
      if (drawInterbaseCounts) {
        let curr = 0
        for (const base of interbaseEvents) {
          const { entryDepth } = snpinfo.noncov[base]!
          const r = 0.6
          ctx.fillStyle = colorForBase[base]!
          ctx.fillRect(
            leftPx - r + extraHorizontallyFlippedOffset,
            INTERBASE_INDICATOR_HEIGHT + toHeight2(curr),
            r * 2,
            toHeight2(entryDepth),
          )
          curr += entryDepth
        }
      }

      if (drawIndicators) {
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
          ctx.fillStyle = colorForBase[maxBase]!
          ctx.beginPath()
          const l = leftPx + extraHorizontallyFlippedOffset
          ctx.moveTo(l - INTERBASE_INDICATOR_WIDTH / 2, 0)
          ctx.lineTo(l + INTERBASE_INDICATOR_WIDTH / 2, 0)
          ctx.lineTo(l, INTERBASE_INDICATOR_HEIGHT)
          ctx.fill()
        }
      }
      prevTotal = score0
    }

    if (drawArcs) {
      for (const f of feats) {
        if (f.get('type') !== 'skip') {
          continue
        }
        const s = f.get('start')
        const e = f.get('end')
        const [left, right] = bpSpanPx(s, e, region, bpPerPx)

        ctx.beginPath()
        const effectiveStrand = f.get('effectiveStrand')
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

        ctx.lineWidth = Math.log(f.get('score') + 1)
        ctx.moveTo(left, height - offset * 2)
        ctx.bezierCurveTo(left, 0, right, 0, right, height - offset * 2)
        ctx.stroke()
      }
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
    return undefined
  }
}
