import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { clamp, featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import { getOrigin, getScale, groupBy, ScaleOpts } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

function fillRect(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  path?: Path2D,
  color?: string,
) {
  if (path) {
    path.rect(x, y, width, height)
  } else {
    if (color) {
      ctx.fillStyle = color
    }
    ctx.fillRect(x, y, width, height)
  }
}

interface MultiArgs extends RenderArgsDeserializedWithFeatures {
  sources: string[]
  sourceColors: { [key: string]: string }
}

export default class MultiXYPlotRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiArgs) {
    const { bpPerPx, sources, regions, features } = props
    const [region] = regions
    const groups = groupBy([...features.values()], f => f.get('source'))
    const height = props.height / Object.keys(groups).length
    const width = (region.end - region.start) / bpPerPx
    const Color = await import('color').then(f => f.default)
    ctx.save()
    sources.forEach((source, idx) => {
      this.drawFeats(ctx, {
        ...props,
        features: groups[source],
        height,
        source,
        idx,
        Color,
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
      scaleOpts: ScaleOpts
      height: number
      ticks: { values: number[] }
      config: AnyConfigurationModel
      displayCrossHatches: boolean
      exportSVG?: { rasterizeLayers?: boolean }
      idx: number
      source: string
      sourceColors: { [key: string]: string }
      Color: any
    },
  ) {
    const {
      features,
      bpPerPx,
      regions,
      scaleOpts,
      height,
      config,
      exportSVG,
      source,
      sourceColors,
      Color,
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

    const color = sourceColors[source]
    const minColor = color && Color(color).darken(0.6).toString()
    const maxColor = color && Color(color).lighten(0.6).toString()
    console.log({ color, minColor, maxColor })

    // first pass: uses path2d for faster rendering

    const usePath = exportSVG || typeof Path2D === 'undefined'
    const path = usePath ? undefined : new Path2D()
    const pathMin = usePath ? undefined : new Path2D()
    const pathMax = usePath ? undefined : new Path2D()

    let hasClipping = false
    console.log({ summaryScoreMode })
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      let score = feature.get('score')

      hasClipping ||= score < niceMin || score > niceMax
      const w = rightPx - leftPx + 0.4 // fudge factor for subpixel rendering
      const h = filled ? toHeight(score) : 1
      if (summaryScoreMode === 'whiskers') {
        const summary = feature.get('summary')

        if (summary) {
          const maxr = feature.get('maxScore')
          const minr = feature.get('minScore')
          const h1 = filled ? toHeight(maxr) : 1
          fillRect(leftPx, toY(maxr), w, h1, ctx, pathMax, maxColor)
          const h2 = filled ? toHeight(minr) : 1
          fillRect(leftPx, toY(minr), w, h2, ctx, pathMin, minColor)
        }
        fillRect(leftPx, toY(score), w, h, ctx, path, color)
      } else if (summaryScoreMode === 'max') {
        const maxr = feature.get('maxScore')
        const summary = feature.get('summary')
        score = summary ? maxr : score
        fillRect(leftPx, toY(score), w, h, ctx, path, color)
      } else if (summaryScoreMode === 'min') {
        const minr = feature.get('minScore')
        const summary = feature.get('summary')
        score = summary ? minr : score
        fillRect(leftPx, toY(score), w, h, ctx, path, color)
      } else {
        fillRect(leftPx, toY(score), w, h, ctx, path, color)
      }
    }
    if (path && pathMin && pathMax) {
      ctx.fillStyle = minColor
      ctx.fill(pathMin)
      ctx.fillStyle = maxColor
      ctx.fill(pathMax)
      ctx.fillStyle = color
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
        const score = feature.get('score')
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
