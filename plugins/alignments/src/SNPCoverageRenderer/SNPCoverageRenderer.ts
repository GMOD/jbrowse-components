import { createJBrowseTheme } from '@jbrowse/core/ui'
import { featureSpanPx, bpSpanPx } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { RenderArgsDeserialized as FeatureRenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import {
  getOrigin,
  getScale,
  ScaleOpts,
  WiggleBaseRenderer,
  YSCALEBAR_LABEL_OFFSET,
} from '@jbrowse/plugin-wiggle'

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  ticks: { values: number[] }
  displayCrossHatches: boolean
  modificationTagMap?: Record<string, string>
}

type Counts = {
  [key: string]: { total: number; strands: { [key: string]: number } }
}

interface SNPInfo {
  cov: Counts
  noncov: Counts
  total: number
}

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const {
      features,
      regions,
      bpPerPx,
      displayCrossHatches,
      modificationTagMap = {},
      scaleOpts,
      height: unadjustedHeight,
      theme: configTheme,
      config: cfg,
      ticks,
    } = props
    const theme = createJBrowseTheme(configTheme)
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const offset = YSCALEBAR_LABEL_OFFSET
    const height = unadjustedHeight - offset * 2

    const { domain } = scaleOpts
    if (!domain) {
      return
    }
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
    const drawInterbaseCounts = readConfObject(cfg, 'drawInterbaseCounts')
    const drawArcs = readConfObject(cfg, 'drawArcs')
    const drawIndicators = readConfObject(cfg, 'drawIndicators')

    // get the y coordinate that we are plotting at, this can be log scale
    const toY = (n: number) => height - (viewScale(n) || 0) + offset
    const toHeight = (n: number) => toY(originY) - toY(n)

    const indicatorToY = (n: number) =>
      height - (indicatorViewScale(n) || 0) + offset
    const indicatorToHeight = (n: number) =>
      indicatorToY(getOrigin('linear')) - indicatorToY(n)

    // @ts-ignore
    const { bases } = theme.palette
    const colorForBase: { [key: string]: string } = {
      A: bases.A.main,
      C: bases.C.main,
      G: bases.G.main,
      T: bases.T.main,
      total: 'lightgrey',
      insertion: 'purple',
      softclip: 'blue',
      hardclip: 'red',
      meth: 'red',
      unmeth: 'blue',
      ref: 'lightgrey',
    }

    const feats = [...features.values()]
    const coverage = feats.filter(f => f.get('type') !== 'skip')
    const skips = feats.filter(f => f.get('type') === 'skip')

    // Use two pass rendering, which helps in visualizing the SNPs at higher
    // bpPerPx First pass: draw the gray background
    ctx.fillStyle = colorForBase.total
    for (let i = 0; i < coverage.length; i++) {
      const feature = coverage[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.3
      const score = feature.get('score') as number
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
    }

    // Keep track of previous total which we will use it to draw the interbase
    // indicator (if there is a sudden clip, there will be no read coverage but
    // there will be "clip" coverage) at that position beyond the read. if the
    // clip is right at a block boundary then prevTotal will not be available,
    // so this is a best attempt to plot interbase indicator at the "cliffs"
    let prevTotal = 0

    // extraHorizontallyFlippedOffset is used to draw interbase items, which
    // are located to the left when forward and right when reversed
    const extraHorizontallyFlippedOffset = region.reversed ? 1 / bpPerPx : 0

    // Second pass: draw the SNP data, and add a minimum feature width of 1px
    // which can be wider than the actual bpPerPx This reduces overdrawing of
    // the grey background over the SNPs

    for (let i = 0; i < coverage.length; i++) {
      const feature = coverage[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      const score = feature.get('score') as number
      const snpinfo = feature.get('snpinfo') as SNPInfo
      const w = Math.max(rightPx - leftPx + 0.3, 1)
      const totalScore = snpinfo.total
      const keys = Object.keys(snpinfo.cov).sort()

      let curr = 0
      for (let i = 0; i < keys.length; i++) {
        const base = keys[i]
        const { total } = snpinfo.cov[base]
        ctx.fillStyle =
          colorForBase[base] ||
          modificationTagMap[base.replace('mod_', '')] ||
          '#888'

        const height = toHeight(score)
        const bottom = toY(score) + height
        ctx.fillRect(
          leftPx,
          bottom - ((total + curr) / score) * height,
          w,
          (total / score) * height,
        )
        curr += total
      }

      const interbaseEvents = Object.keys(snpinfo.noncov)
      const indicatorHeight = 4.5
      if (drawInterbaseCounts) {
        let curr = 0
        for (let i = 0; i < interbaseEvents.length; i++) {
          const base = interbaseEvents[i]
          const { total } = snpinfo.noncov[base]
          ctx.fillStyle = colorForBase[base]
          ctx.fillRect(
            leftPx - 0.6 + extraHorizontallyFlippedOffset,
            indicatorHeight + indicatorToHeight(curr),
            1.2,
            indicatorToHeight(total),
          )
          curr += total
        }
      }

      if (drawIndicators) {
        let accum = 0
        let max = 0
        let maxBase = ''
        for (let i = 0; i < interbaseEvents.length; i++) {
          const base = interbaseEvents[i]
          const { total } = snpinfo.noncov[base]
          accum += total
          if (total > max) {
            max = total
            maxBase = base
          }
        }

        // avoid drawing a bunch of indicators if coverage is very low e.g.
        // less than 7, uses the prev total in the case of the "cliff"
        const indicatorComparatorScore = Math.max(totalScore, prevTotal)
        if (
          accum > indicatorComparatorScore * indicatorThreshold &&
          indicatorComparatorScore > 7
        ) {
          ctx.fillStyle = colorForBase[maxBase]
          ctx.beginPath()
          const l = leftPx + extraHorizontallyFlippedOffset
          ctx.moveTo(l - 3.5, 0)
          ctx.lineTo(l + 3.5, 0)
          ctx.lineTo(l, indicatorHeight)
          ctx.fill()
        }
      }
      prevTotal = totalScore
    }

    if (drawArcs) {
      for (let i = 0; i < skips.length; i++) {
        const f = skips[i]
        const [left, right] = bpSpanPx(
          f.get('start'),
          f.get('end'),
          region,
          bpPerPx,
        )

        ctx.beginPath()
        const str = f.get('strand') as number
        const xs = f.get('xs') as string
        const pos = 'rgba(255,200,200,0.7)'
        const neg = 'rgba(200,200,255,0.7)'
        const neutral = 'rgba(200,200,200,0.7)'

        if (xs === '+') {
          ctx.strokeStyle = pos
        } else if (xs === '-') {
          ctx.strokeStyle = neg
        } else if (str === 1) {
          ctx.strokeStyle = pos
        } else if (str === -1) {
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
      ticks.values.forEach(tick => {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(toY(tick)))
        ctx.lineTo(width, Math.round(toY(tick)))
        ctx.stroke()
      })
    }
  }
}
