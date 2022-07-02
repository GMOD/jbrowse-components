import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { featureSpanPx, Feature, Region } from '@jbrowse/core/util'
import {
  getOrigin,
  getScale,
  groupBy,
  ScaleOpts,
  YSCALEBAR_LABEL_OFFSET,
} from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

interface MultiRenderArgs extends RenderArgsDeserializedWithFeatures {
  sources: string[]
  sourceColors: { [key: string]: string }
}

export default class MultiLineRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiRenderArgs) {
    const { sources, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    sources.forEach(source => {
      const features = groups[source]
      if (!features) {
        return
      }
      this.drawFeats(ctx, { ...props, features, source })
    })
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
      source: string
      sourceColors: { [key: string]: string }
    },
  ) {
    const {
      features,
      bpPerPx,
      regions,
      scaleOpts,
      height: unadjustedHeight,
      config,
      ticks,
      displayCrossHatches,
      source,
      sourceColors,
    } = props
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
    // wiggle display, and makes the height of the actual drawn area add
    // "padding" to the top and bottom of the display
    const offset = YSCALEBAR_LABEL_OFFSET
    const height = unadjustedHeight - offset * 2
    const clipColor = readConfObject(config, 'clipColor')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const [niceMin, niceMax] = scale.domain()

    const toY = (n: number) => height - (scale(n) || 0) + offset
    const color = sourceColors[source]

    let lastVal
    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const score = feature.get('score')
      ctx.strokeStyle = color
      ctx.beginPath()
      const startPos = typeof lastVal !== 'undefined' ? lastVal : score
      if (!region.reversed) {
        ctx.moveTo(leftPx, toY(startPos))
        ctx.lineTo(leftPx, toY(score))
        ctx.lineTo(rightPx, toY(score))
      } else {
        ctx.moveTo(leftPx, toY(startPos))
        ctx.lineTo(rightPx, toY(score))
        ctx.lineTo(leftPx, toY(score))
      }
      ctx.stroke()
      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      if (highClipping) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, 0, w, 4)
      } else if (lowClipping && scaleOpts.scaleType !== 'log') {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, unadjustedHeight - 4, w, 4)
      }

      lastVal = score
    }

    if (displayCrossHatches) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(200,200,200,0.8)'
      ticks.values.forEach(tick => {
        ctx.beginPath()
        ctx.moveTo(0, Math.round(toY(tick)))
        ctx.lineTo(width, Math.round(toY(tick)))
        ctx.stroke()
      })
      const originY = getOrigin(scaleOpts.scaleType)
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(originY)))
      ctx.lineTo(width, Math.round(toY(originY)))
      ctx.stroke()
    }
  }
}
