import { createJBrowseTheme } from '@jbrowse/core/ui'
import { featureSpanPx } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
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
  draw(ctx: CanvasRenderingContext2D, props: SNPCoverageRendererProps) {
    const {
      features,
      regions,
      bpPerPx,
      scaleOpts,
      height,
      theme: configTheme,
    } = props
    const theme = createJBrowseTheme(configTheme)

    const [region] = regions
    const viewScale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const toY = (rawscore: number, curr = 0) =>
      height - viewScale(rawscore) - curr
    const toHeight = (rawscore: number, curr = 0) =>
      toY(originY) - toY(rawscore, curr)

    const insRegex = /^ins.[A-Za-z0-9]/
    const colorForBase: { [key: string]: string } = {
      A: theme.palette.bases.A.main,
      C: theme.palette.bases.C.main,
      G: theme.palette.bases.G.main,
      T: theme.palette.bases.T.main,
      total: 'lightgrey',
    }

    // Use two pass rendering, which helps in visualizing the SNPs at higher bpPerPx
    // First pass: draw the gray background
    // Second pass: draw the SNP data, and add a minimum feature width of 1px which can be wider than the actual bpPerPx
    // This reduces overdrawing of the grey background over the SNPs
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score') as number
      // console.log(score, toHeight(score))

      // draw total
      ctx.fillStyle = colorForBase.total
      const w = rightPx - leftPx + 0.3
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
    }
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = Math.max(rightPx - leftPx + 0.3, 1)
      // grab array with nestedtable's info, draw mismatches
      const infoArray = feature.get('snpinfo') || []
      let curr = 0
      infoArray.forEach(function iterate(info: BaseInfo) {
        if (!info || info.base === 'reference' || info.base === 'total') {
          return
        }
        ctx.fillStyle = info.base.match(insRegex)
          ? 'darkgrey'
          : colorForBase[info.base]
        ctx.fillRect(leftPx, toY(info.score + curr), w, toHeight(info.score))
        curr += info.score
      })
    }
  }
}
