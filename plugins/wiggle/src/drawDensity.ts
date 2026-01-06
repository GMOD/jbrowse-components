import { readConfObject } from '@jbrowse/core/configuration'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { fillRectCtx, getScale } from './util.ts'

import type { ScaleOpts } from './util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type {
  LastStopTokenCheck,
  StopToken,
} from '@jbrowse/core/util/stopToken'

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
    stopToken?: StopToken
    lastCheck?: LastStopTokenCheck
  },
) {
  const {
    features,
    regions,
    bpPerPx,
    scaleOpts,
    height,
    config,
    stopToken,
    lastCheck = createStopTokenChecker(stopToken),
  } = props
  const region = regions[0]!
  const regionStart = region.start
  const regionEnd = region.end
  const regionReversed = region.reversed
  const inverseBpPerPx = 1 / bpPerPx

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
  let hasClipping = false
  const reducedFeatures = []
  for (const feature of features.values()) {
    checkStopToken2(lastCheck)
    const fStart = feature.get('start')
    const fEnd = feature.get('end')
    const leftPx = regionReversed
      ? (regionEnd - fEnd) * inverseBpPerPx
      : (fStart - regionStart) * inverseBpPerPx
    const rightPx = regionReversed
      ? (regionEnd - fStart) * inverseBpPerPx
      : (fEnd - regionStart) * inverseBpPerPx

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx) || rightPx - leftPx > 1) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }
    const score = feature.get('score')
    hasClipping = hasClipping || score > niceMax || score < niceMin
    const w = rightPx - leftPx + fudgeFactor
    if (score >= scaleOpts.domain[0]!) {
      ctx.fillStyle = cb(feature, score)
      ctx.fillRect(leftPx, 0, w, height)
    } else {
      ctx.fillStyle = '#eee'
      ctx.fillRect(leftPx, 0, w, height)
    }
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    for (const feature of features.values()) {
      checkStopToken2(lastCheck)
      const fStart = feature.get('start')
      const fEnd = feature.get('end')
      const leftPx = regionReversed
        ? (regionEnd - fEnd) * inverseBpPerPx
        : (fStart - regionStart) * inverseBpPerPx
      const rightPx = regionReversed
        ? (regionEnd - fStart) * inverseBpPerPx
        : (fEnd - regionStart) * inverseBpPerPx
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score')
      if (score > niceMax) {
        fillRectCtx(leftPx, 0, w, clipHeight, ctx)
      } else if (score < niceMin && scaleOpts.scaleType !== 'log') {
        fillRectCtx(leftPx, 0, w, clipHeight, ctx)
      }
    }
  }
  ctx.restore()

  return {
    reducedFeatures,
  }
}
