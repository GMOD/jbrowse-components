import { readConfObject } from '@jbrowse/core/configuration'
import { clamp, featureSpanPx } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

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
    stopToken?: string
    // when color is static (e.g. in Multi renderers), set strokeStyle once and skip callback
    staticColor?: string
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
    stopToken,
    staticColor,
  } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

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
  const isLog = scaleOpts.scaleType === 'log'
  const reversed = region.reversed

  // when staticColor is set, batch all path operations into a single stroke
  if (staticColor) {
    ctx.beginPath()
    ctx.strokeStyle = staticColor
    const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []

    let start = performance.now()
    for (const feature of features.values()) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      // create reduced features, avoiding multiple features per px
      // bitwise OR is faster than Math.floor for positive numbers
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }
      const score = feature.get('score')
      const scoreY = toY(score)

      // track clipping
      if (score > niceMax) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: true })
      } else if (score < niceMin && !isLog) {
        clippingFeatures.push({ leftPx, w: rightPx - leftPx + fudgeFactor, high: false })
      }

      const startY = lastVal !== undefined ? toY(lastVal) : scoreY
      if (!reversed) {
        ctx.moveTo(leftPx, startY)
        ctx.lineTo(leftPx, scoreY)
        ctx.lineTo(rightPx, scoreY)
      } else {
        ctx.moveTo(rightPx, startY)
        ctx.lineTo(rightPx, scoreY)
        ctx.lineTo(leftPx, scoreY)
      }
      lastVal = score
    }
    // single stroke for entire path
    ctx.stroke()

    // draw clipping indicators
    if (clippingFeatures.length > 0) {
      ctx.fillStyle = clipColor
      for (const { leftPx, w, high } of clippingFeatures) {
        if (high) {
          ctx.fillRect(leftPx, offset, w, clipHeight)
        } else {
          ctx.fillRect(leftPx, height - clipHeight, w, height)
        }
      }
    }
  } else {
    // non-static color: stroke per feature (original behavior)
    let start = performance.now()
    for (const feature of features.values()) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

      // create reduced features, avoiding multiple features per px
      // bitwise OR is faster than Math.floor for positive numbers
      if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
        reducedFeatures.push(feature)
        prevLeftPx = leftPx
      }
      const score = feature.get('score')
      const scoreY = toY(score)
      const w = rightPx - leftPx + fudgeFactor

      const c = colorCallback(feature, score)

      ctx.beginPath()
      ctx.strokeStyle = c
      const startY = lastVal !== undefined ? toY(lastVal) : scoreY
      if (!reversed) {
        ctx.moveTo(leftPx, startY)
        ctx.lineTo(leftPx, scoreY)
        ctx.lineTo(rightPx, scoreY)
      } else {
        ctx.moveTo(rightPx, startY)
        ctx.lineTo(rightPx, scoreY)
        ctx.lineTo(leftPx, scoreY)
      }
      ctx.stroke()
      lastVal = score

      if (score > niceMax) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, offset, w, clipHeight)
      } else if (score < niceMin && !isLog) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, height - clipHeight, w, height)
      }
    }
  }

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of values) {
      ctx.beginPath()
      ctx.moveTo(0, Math.round(toY(tick)))
      ctx.lineTo(width, Math.round(toY(tick)))
      ctx.stroke()
    }
  }
  return {
    reducedFeatures,
  }
}
