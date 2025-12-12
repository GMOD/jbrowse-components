import { readConfObject } from '@jbrowse/core/configuration'
import { clamp } from '@jbrowse/core/util'
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
  } = props
  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const width = (regionEnd - regionStart) * invBpPerPx

  const height = unadjustedHeight - offset * 2
  const clipColor = readConfObject(config, 'clipColor')

  // Use d3-scale only to get the "niced" domain, then use simple arithmetic
  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale.domain() as [number, number]
  const niceMin = domain[0]
  const niceMax = domain[1]
  const domainSpan = niceMax - niceMin
  const isLog = scaleOpts.scaleType === 'log'

  // Precompute values for linear scale
  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0

  // Precompute values for log scale (base 2)
  const log2 = Math.log(2)
  const logMin = Math.log(niceMin) / log2
  const logMax = Math.log(niceMax) / log2
  const logSpan = logMax - logMin
  const logRatio = logSpan !== 0 ? height / logSpan : 0

  // Simple arithmetic scale function - avoid d3-scale overhead in hot path
  const toY = isLog
    ? (n: number) =>
        clamp(height - (Math.log(n) / log2 - logMin) * logRatio, 0, height) +
        offset
    : (n: number) =>
        clamp(height - (n - niceMin) * linearRatio, 0, height) + offset

  let lastVal: number | undefined
  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  let start = performance.now()
  for (const feature of features.values()) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const leftPx = reversed
      ? (regionEnd - fend) * invBpPerPx
      : (fstart - regionStart) * invBpPerPx
    const rightPx = reversed
      ? (regionEnd - fstart) * invBpPerPx
      : (fend - regionStart) * invBpPerPx

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx) || rightPx - leftPx > 1) {
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
    if (!reversed) {
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
