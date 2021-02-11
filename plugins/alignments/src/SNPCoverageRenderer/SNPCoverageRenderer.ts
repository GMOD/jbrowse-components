import { createJBrowseTheme } from '@jbrowse/core/ui'
import { featureSpanPx } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  getOrigin,
  getScale,
  ScaleOpts,
  WiggleBaseRenderer,
} from '@jbrowse/plugin-wiggle'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { ThemeOptions } from '@material-ui/core'

interface SNPCoverageRendererProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseFeatureDataAdapter
  notReady: boolean
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  displayModel: unknown
  theme: ThemeOptions
}

interface BaseInfo {
  base: string
  score: number
  strands?: {
    [key: string]: number
  }
}

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  draw(ctx: CanvasRenderingContext2D, props: SNPCoverageRendererProps) {
    const {
      features,
      regions,
      bpPerPx,
      scaleOpts,
      height,
      theme: configTheme,
      config,
    } = props
    const theme = createJBrowseTheme(configTheme)

    const [region] = regions
    const opts = { ...scaleOpts, range: [0, height] }

    const viewScale = getScale(opts)
    const snpViewScale = getScale({ ...opts, scaleType: 'linear' })

    const originY = getOrigin(scaleOpts.scaleType)
    const snpOriginY = getOrigin('linear')
    const indicatorThreshold = readConfObject(config, 'indicatorThreshold')

    const toY = (n: number, curr = 0) => height - viewScale(n) - curr
    const snpToY = (n: number, curr = 0) => height - snpViewScale(n) - curr
    const toHeight = (n: number, curr = 0) => toY(originY) - toY(n, curr)
    const snpToHeight = (n: number, curr = 0) =>
      snpToY(snpOriginY) - snpToY(n, curr)

    const colorForBase: { [key: string]: string } = {
      A: theme.palette.bases.A.main,
      C: theme.palette.bases.C.main,
      G: theme.palette.bases.G.main,
      T: theme.palette.bases.T.main,
      total: 'lightgrey',
      insertion: 'purple',
      softclip: 'blue',
      hardclip: 'red',
    }

    // Use two pass rendering, which helps in visualizing the SNPs at higher
    // bpPerPx First pass: draw the gray background
    ctx.fillStyle = colorForBase.total
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score') as number
      ctx.fillRect(leftPx, toY(score), rightPx - leftPx + 0.3, toHeight(score))
    }

    // Second pass: draw the SNP data, and add a minimum feature width of 1px
    // which can be wider than the actual bpPerPx This reduces overdrawing of
    // the grey background over the SNPs
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const infoArray: BaseInfo[] = feature.get('snpinfo') || []
      const total = infoArray.find(info => info.base === 'total')
      const totalScore = total?.score || 0
      infoArray.reduce((curr, info) => {
        const { base, score } = info
        if (base !== 'reference' && base !== 'total') {
          ctx.fillStyle = colorForBase[info.base]
          const indicatorType =
            base === 'insertion' || base === 'softclip' || base === 'hardclip'

          if (indicatorType && score > totalScore * indicatorThreshold) {
            ctx.beginPath()
            ctx.moveTo(leftPx - 3, 0)
            ctx.lineTo(leftPx + 3, 0)
            ctx.lineTo(leftPx, 4.5)
            ctx.fill()
          }
          if (!indicatorType && base !== 'deletion') {
            ctx.fillRect(
              leftPx,
              snpToY(score + curr),
              Math.max(rightPx - leftPx + 0.3, 1),
              snpToHeight(score),
            )
            return curr + info.score
          }
        }
        return curr
      }, 0)
    }
  }
}
