import { createJBrowseTheme } from '@jbrowse/core/ui'
import { featureSpanPx } from '@jbrowse/core/util'
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
  modificationTagMap: Record<string, string>
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
      scaleOpts,
      height: unadjustedHeight,
      theme: configTheme,
      config: cfg,
      displayCrossHatches,
      ticks: { values },
      modificationTagMap,
    } = props
    const theme = createJBrowseTheme(configTheme)
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const offset = YSCALEBAR_LABEL_OFFSET
    const height = unadjustedHeight - offset * 2

    const opts = { ...scaleOpts, range: [0, height] }
    const viewScale = getScale(opts)
    const snpViewScale = getScale({ ...opts, scaleType: 'linear' })
    const originY = getOrigin(scaleOpts.scaleType)
    const snpOriginY = getOrigin('linear')

    const indicatorThreshold = readConfObject(cfg, 'indicatorThreshold')
    const drawInterbaseCounts = readConfObject(cfg, 'drawInterbaseCounts')
    const drawIndicators = readConfObject(cfg, 'drawIndicators')

    // get the y coordinate that we are plotting at, this can be log scale
    const toY = (n: number) => height - viewScale(n) + offset
    const toHeight = (n: number) => toY(originY) - toY(n)

    // this is always linear scale, even when plotted on top of log scale
    const snpToY = (n: number) => height - snpViewScale(n) + offset
    const snpToHeight = (n: number) => snpToY(snpOriginY) - snpToY(n)

    const colorForBase: { [key: string]: string } = {
      A: theme.palette.bases.A.main,
      C: theme.palette.bases.C.main,
      G: theme.palette.bases.G.main,
      T: theme.palette.bases.T.main,
      total: 'lightgrey',
      insertion: 'purple',
      softclip: 'blue',
      hardclip: 'red',
      meth: 'red',
      unmeth: 'blue',
      ref: 'lightgrey',
    }

    // Use two pass rendering, which helps in visualizing the SNPs at higher
    // bpPerPx First pass: draw the gray background
    ctx.fillStyle = colorForBase.total
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.3
      const score = feature.get('score') as number
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
    }
    ctx.fillStyle = 'grey'
    ctx.beginPath()
    ctx.lineTo(0, 0)
    ctx.moveTo(0, width)
    ctx.stroke()

    // Second pass: draw the SNP data, and add a minimum feature width of 1px
    // which can be wider than the actual bpPerPx This reduces overdrawing of
    // the grey background over the SNPs
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      type Counts = {
        [key: string]: { total: number; strands: { [key: string]: number } }
      }
      const snpinfo = feature.get('snpinfo') as {
        cov: Counts
        noncov: Counts
        total: number
      }
      const w = Math.max(rightPx - leftPx + 0.3, 1)
      const totalScore = snpinfo.total

      Object.entries(snpinfo.cov)
        .sort(([a], [b]) => {
          if (a < b) {
            return -1
          }
          if (a > b) {
            return 1
          }
          return 0
        })
        .reduce((curr, [base, { total }]) => {
          ctx.fillStyle =
            colorForBase[base] ||
            modificationTagMap[base.replace('mod_', '')] ||
            'red'
          ctx.fillRect(leftPx, snpToY(total + curr), w, snpToHeight(total))
          return curr + total
        }, 0)

      const interbaseEvents = Object.entries(snpinfo.noncov)
      const indicatorHeight = 4.5
      if (drawInterbaseCounts) {
        interbaseEvents.reduce((curr, [base, { total }]) => {
          ctx.fillStyle = colorForBase[base]
          ctx.fillRect(
            leftPx - 0.6,
            indicatorHeight + snpToHeight(curr),
            1.2,
            snpToHeight(total),
          )
          return curr + total
        }, 0)
      }

      if (drawIndicators) {
        let accum = 0
        let max = 0
        let maxBase = ''
        interbaseEvents.forEach(([base, { total }]) => {
          accum += total
          if (total > max) {
            max = total
            maxBase = base
          }
        })

        // avoid drawing a bunch of indicators if coverage is very low e.g.
        // less than 7
        if (accum > totalScore * indicatorThreshold && totalScore > 7) {
          ctx.fillStyle = colorForBase[maxBase]
          ctx.beginPath()
          ctx.moveTo(leftPx - 3, 0)
          ctx.lineTo(leftPx + 3, 0)
          ctx.lineTo(leftPx, indicatorHeight)
          ctx.fill()
        }
      }
    }

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(140,140,140,0.8)'
      values.forEach(tick => {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(toY(tick)))
        ctx.lineTo(width, Math.round(toY(tick)))
        ctx.stroke()
      })
    }
  }
}
