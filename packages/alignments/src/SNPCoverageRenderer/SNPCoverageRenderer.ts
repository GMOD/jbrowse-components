import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import {
  getOrigin,
  getScale,
  ScaleOpts,
} from '@gmod/jbrowse-plugin-wiggle/src/util'
import WiggleBaseRenderer from '@gmod/jbrowse-plugin-wiggle/src/WiggleBaseRenderer'

interface SNPCoverageRendererProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseAdapter
  notReady: boolean
  originalRegion: IRegion
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  trackModel: unknown
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
      region,
      bpPerPx,
      scaleOpts,
      height,
      horizontallyFlipped,
    } = props

    const viewScale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const toY = (rawscore: number, curr = 0) =>
      height - viewScale(rawscore) - curr
    const toHeight = (rawscore: number, curr = 0) =>
      toY(originY) - toY(rawscore, curr)

    const insRegex = /^ins.[A-Za-z0-9]/
    const colorForBase: { [key: string]: string } = {
      A: '#00bf00',
      C: '#4747ff',
      G: '#ffa500',
      T: '#f00',
      total: 'lightgrey',
    }

    // Use two pass rendering, which helps in visualizing the SNPs at higher bpPerPx
    // First pass: draw the gray background
    // Second pass: draw the SNP data, and add a minimum feature width of 1px which can be wider than the actual bpPerPx
    // This reduces overdrawing of the grey background over the SNPs
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(
        feature,
        region,
        bpPerPx,
        horizontallyFlipped,
      )
      const score = feature.get('score')

      // draw total
      ctx.fillStyle = colorForBase.total
      const w = rightPx - leftPx + 0.3
      ctx.fillRect(leftPx, toY(score), w, toHeight(score))
    }
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(
        feature,
        region,
        bpPerPx,
        horizontallyFlipped,
      )
      const w = Math.max(rightPx - leftPx + 0.3, 1)
      // grab array with nestedtable's info, draw mismatches
      const infoArray = feature.get('snpinfo') || []
      let curr = 0
      infoArray.forEach(function iterate(info: BaseInfo, index: number) {
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
