import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { fillRectCtx, getScale } from './util'

import type { ScaleOpts } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const fudgeFactor = 0.3
const clipHeight = 2

export function drawDensity(
  ctx: CanvasRenderingContext2D,
  props: {
    features: Map<string, Feature> | Feature[]
    regions: Region[]
    bpPerPx: number
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    displayCrossHatches: boolean
    config: AnyConfigurationModel
    stopToken?: string
  },
) {
  const { stopToken, features, regions, bpPerPx, scaleOpts, height, config } =
    props
  const region = regions[0]!
  const pivot = readConfObject(config, 'bicolorPivot')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  const color = readConfObject(config, 'color')
  const clipColor = readConfObject(config, 'clipColor')
  const crossing = pivot !== 'none' && scaleOpts.scaleType !== 'log'
  const scale = getScale({
    ...scaleOpts,
    pivotValue: crossing ? pivotValue : undefined,
    range: crossing ? [negColor, '#eee', posColor] : ['#eee', posColor],
  })

  const scale2 = getScale({ ...scaleOpts, range: [0, height] })
  const cb =
    color === '#f0f'
      ? (_: Feature, score: number) => scale(score)
      : (feature: Feature, score: number) =>
          readConfObject(config, 'color', { feature, score })
  const domain = scale2.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!

  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  const clippingFeatures: { leftPx: number; w: number; high: boolean }[] = []
  const isLog = scaleOpts.scaleType === 'log'
  const domainMin = scaleOpts.domain[0]!
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
    const w = rightPx - leftPx + fudgeFactor

    // track clipping during first pass
    if (score > niceMax) {
      clippingFeatures.push({ leftPx, w, high: true })
    } else if (score < niceMin && !isLog) {
      clippingFeatures.push({ leftPx, w, high: false })
    }

    if (score >= domainMin) {
      ctx.fillStyle = cb(feature, score)
      ctx.fillRect(leftPx, 0, w, height)
    } else {
      ctx.fillStyle = '#eee'
      ctx.fillRect(leftPx, 0, w, height)
    }
  }

  // draw clipping indicators from cached data
  if (clippingFeatures.length > 0) {
    ctx.save()
    ctx.fillStyle = clipColor
    for (const { leftPx, w } of clippingFeatures) {
      fillRectCtx(leftPx, 0, w, clipHeight, ctx)
    }
    ctx.restore()
  }

  return {
    reducedFeatures,
  }
}
