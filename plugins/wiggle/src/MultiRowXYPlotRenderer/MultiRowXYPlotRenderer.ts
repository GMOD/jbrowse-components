import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { clamp, featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import { getOrigin, getScale, groupBy } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

const colors = ['red', 'green', 'blue', 'orange']

function fillRect(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  path?: Path2D,
) {
  if (path) {
    path.rect(x, y, width, height)
  } else {
    ctx.fillRect(x, y, width, height)
  }
}

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { bpPerPx, regions, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    const list = Object.values(groups)
    const height = props.height / list.length
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    ctx.save()
    list.forEach((features, idx) => {
      this.drawFeats(ctx, {
        ...props,
        features,
        height,
        color: colors[idx],
        idx,
      })
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ctx.beginPath()
      ctx.moveTo(0, height)
      ctx.lineTo(width, height)
      ctx.stroke()
      ctx.translate(0, height)
    })
    ctx.restore()
  }
  drawFeats(
    ctx: CanvasRenderingContext2D,
    props: {
      features: Feature[]
      bpPerPx: number
      regions: Region[]
      scaleOpts: any
      height: number
      ticks: { values: number[] }
      config: AnyConfigurationModel
      displayCrossHatches: boolean
      color: string
      exportSVG?: { rasterizeLayers?: boolean }
      idx: number
    },
  ) {
    const {
      features,
      bpPerPx,
      regions,
      scaleOpts,
      height,
      config,
      color,
      exportSVG,
    } = props
    const [region] = regions

    const filled = false
    const clipColor = readConfObject(config, 'clipColor')
    const summaryScoreMode = readConfObject(config, 'summaryScoreMode')

    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = scale.domain()

    const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height)
    const toHeight = (n: number) => toY(originY) - toY(n)
    ctx.fillStyle = color

    // first pass: uses path2d for faster rendering
    const path =
      exportSVG || typeof Path2D === 'undefined' ? undefined : new Path2D()
    let hasClipping = false
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      let score = feature.get('score')

      hasClipping ||= score < niceMin || score > niceMax
      const w = rightPx - leftPx + 0.4 // fudge factor for subpixel rendering

      if (summaryScoreMode === 'max') {
        const maxr = feature.get('maxScore')
        const summary = feature.get('summary')
        score = summary ? maxr : score
        fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1, ctx, path)
      } else if (summaryScoreMode === 'min') {
        const minr = feature.get('minScore')
        const summary = feature.get('summary')
        score = summary ? minr : score
        fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1, ctx, path)
      } else {
        fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1, ctx, path)
      }
    }
    if (path) {
      ctx.fill(path)
    }

    // second pass: draw clipping
    if (hasClipping) {
      const path = exportSVG ? undefined : new Path2D()
      ctx.fillStyle = clipColor
      for (let i = 0; i < features.length; i++) {
        const feature = features[i]
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const w = rightPx - leftPx + 0.4 // fudge factor for subpixel rendering
        let score = feature.get('score')
        const lowClipping = score < niceMin
        const highClipping = score > niceMax
        if (highClipping) {
          fillRect(leftPx, 0, w, 4, ctx, path)
        } else if (lowClipping && scaleOpts.scaleType !== 'log') {
          fillRect(leftPx, height - 4, w, 4, ctx, path)
        }
      }
      if (path) {
        ctx.fill(path)
      }
    }
  }
}
