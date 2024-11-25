import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'

// locals
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
  },
) {
  const { features, regions, bpPerPx, scaleOpts, height, config } = props
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
    range: crossing ? [negColor, 'white', posColor] : ['white', posColor],
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
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

    // create reduced features, avoiding multiple features per px
    if (Math.floor(leftPx) !== Math.floor(prevLeftPx)) {
      reducedFeatures.push(feature)
      prevLeftPx = leftPx
    }
    const score = feature.get('score')
    hasClipping = hasClipping || score > niceMax || score < niceMin
    const w = rightPx - leftPx + fudgeFactor
    ctx.fillStyle = cb(feature, score)
    ctx.fillRect(leftPx, 0, w, height)
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
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

  return { reducedFeatures }
}
