import { readConfObject } from '@jbrowse/core/configuration'
import { clamp, featureSpanPx } from '@jbrowse/core/util'

// locals
import { getScale } from './util'
import type { ScaleOpts } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const fudgeFactor = 0.3
const clipHeight = 2

export function drawLine(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Map<string, Feature> | Feature[]
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    displayCrossHatches: boolean
    colorCallback: (f: Feature, score: number) => string
    config: AnyConfigurationModel
    offset?: number
  },
) {
  const {
    features,
    regions,
    bpPerPx,
    scaleOpts,
    height: unadjustedHeight,
    ticks: { values },
    displayCrossHatches,
    colorCallback,
    config,
    offset = 0,
  } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  // the adjusted height takes into account YSCALEBAR_LABEL_OFFSET from the
  // wiggle display, and makes the height of the actual drawn area add
  // "padding" to the top and bottom of the display
  const height = unadjustedHeight - offset * 2
  const clipColor = readConfObject(config, 'clipColor')
  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!
  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset

  let lastVal: number | undefined
  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  for (const feature of features.values()) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }
    const score = feature.get('score')
    const lowClipping = score < niceMin
    const highClipping = score > niceMax
    const w = rightPx - leftPx + fudgeFactor

    const c = colorCallback(feature, score)

    ctx.beginPath()
    ctx.strokeStyle = c
    const startPos = lastVal !== undefined ? lastVal : score
    if (!region.reversed) {
      ctx.moveTo(leftPx, toY(startPos))
      ctx.lineTo(leftPx, toY(score))
      ctx.lineTo(rightPx, toY(score))
    } else {
      ctx.moveTo(rightPx, toY(startPos))
      ctx.lineTo(rightPx, toY(score))
      ctx.lineTo(leftPx, toY(score))
    }
    ctx.stroke()
    lastVal = score

    if (highClipping) {
      ctx.fillStyle = clipColor
      ctx.fillRect(leftPx, offset, w, clipHeight)
    } else if (lowClipping && scaleOpts.scaleType !== 'log') {
      ctx.fillStyle = clipColor
      ctx.fillRect(leftPx, height - clipHeight, w, height)
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    values.forEach(tick => {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    })
  }
  return { reducedFeatures }
}
