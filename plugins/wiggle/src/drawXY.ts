import { readConfObject } from '@jbrowse/core/configuration'
import { clamp, featureSpanPx } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
// required to import this for typescript purposes
import mix from 'colord/plugins/mix' // eslint-disable-line @typescript-eslint/no-unused-vars

import { getOrigin, getScale } from './util'

import type { ScaleOpts } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Colord } from '@jbrowse/core/util/colord'

function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}

function addRectToPath(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }
  ctx.rect(x, y, width, height)
}

function lighten(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 + amount)
  return colord({
    ...hslColor,
    l: clamp(l, 0, 100),
  })
}

function darken(color: Colord, amount: number) {
  const hslColor = color.toHsl()
  const l = hslColor.l * (1 - amount)
  return colord({
    ...hslColor,
    l: clamp(l, 0, 100),
  })
}

const fudgeFactor = 0.3
const clipHeight = 2

export function drawXY(
  ctx: CanvasRenderingContext2D,
  props: {
    stopToken?: string
    features: Map<string, Feature> | Feature[]
    bpPerPx: number
    regions: Region[]
    scaleOpts: ScaleOpts
    height: number
    ticks: { values: number[] }
    config: AnyConfigurationModel
    displayCrossHatches: boolean
    inverted: boolean
    offset?: number
    colorCallback: (f: Feature, score: number) => string
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
    offset = 0,
    colorCallback,
    inverted,
    stopToken,
  } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const height = unadjustedHeight - offset * 2

  const filled = readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const minSize = readConfObject(config, 'minSize')

  const scale = getScale({ ...scaleOpts, range: [0, height], inverted })
  const originY = getOrigin(scaleOpts.scaleType)
  const domain = scale.domain()
  const niceMin = domain[0]!
  const niceMax = domain[1]!

  const toY = (n: number) => clamp(height - (scale(n) || 0), 0, height) + offset
  const toOrigin = (n: number) => toY(originY) - toY(n)
  const getHeight = (n: number) => (filled ? toOrigin(n) : Math.max(minSize, 1))
  let hasClipping = false

  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  const crossingOrigin = niceMin < pivotValue && niceMax > pivotValue

  let start = performance.now()

  // we handle whiskers separately to render max row, min row, and avg in three
  // passes. this reduces subpixel rendering issues. note: for stylistic
  // reasons, clipping indicator is only drawn for score, not min/max score
  if (summaryScoreMode === 'whiskers') {
    const featuresArray = [...features.values()]
    let constantColor: string | undefined
    let canBatch = !crossingOrigin && featuresArray.length > 0

    if (canBatch) {
      const firstFeature = featuresArray[0]!
      const firstScore = firstFeature.get('score')
      constantColor = colorCallback(firstFeature, firstScore)

      for (const feature of featuresArray) {
        const score = feature.get('score')
        if (colorCallback(feature, score) !== constantColor) {
          canBatch = false
          break
        }
      }
    }

    if (canBatch && constantColor) {
      const lightenedColor = lighten(colord(constantColor), 0.4).toHex()
      const darkenedColor = darken(colord(constantColor), 0.4).toHex()

      // pass 1: max scores (lightened)
      ctx.beginPath()
      start = performance.now()
      for (const feature of featuresArray) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        if (feature.get('summary')) {
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          const max = feature.get('maxScore')
          addRectToPath(leftPx, toY(max), w, getHeight(max), ctx)
        }
      }
      ctx.fillStyle = lightenedColor
      ctx.fill()

      // pass 2: mean scores
      ctx.beginPath()
      start = performance.now()
      for (const feature of featuresArray) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const score = feature.get('score')
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        if (
          Math.floor(leftPx) !== Math.floor(prevLeftPx) ||
          rightPx - leftPx > 1
        ) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }
        hasClipping = hasClipping || score < niceMin || score > niceMax
        addRectToPath(leftPx, toY(score), w, getHeight(score), ctx)
      }
      ctx.fillStyle = constantColor
      ctx.fill()

      // pass 3: min scores (darkened)
      ctx.beginPath()
      start = performance.now()
      for (const feature of featuresArray) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        if (feature.get('summary')) {
          const min = feature.get('minScore')
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          addRectToPath(leftPx, toY(min), w, getHeight(min), ctx)
        }
      }
      ctx.fillStyle = darkenedColor
      ctx.fill()
    } else {
      let lastCol: string | undefined
      let lastMix: string | undefined
      start = performance.now()
      for (const feature of features.values()) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        if (feature.get('summary')) {
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          const max = feature.get('maxScore')
          const c = colorCallback(feature, max)
          const effectiveC = crossingOrigin
            ? c
            : c === lastCol
              ? lastMix
              : (lastMix = lighten(colord(c), 0.4).toHex())
          fillRectCtx(leftPx, toY(max), w, getHeight(max), ctx, effectiveC)
          lastCol = c
        }
      }
      lastMix = undefined
      lastCol = undefined
      start = performance.now()
      for (const feature of features.values()) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const score = feature.get('score')
        const max = feature.get('maxScore')
        const min = feature.get('minScore')
        const summary = feature.get('summary')
        const c = colorCallback(feature, score)
        const effectiveC =
          crossingOrigin && summary
            ? c === lastCol
              ? lastMix
              : (lastMix = colord(colorCallback(feature, max))
                  .mix(colord(colorCallback(feature, min)))
                  .toString())
            : c
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        if (
          Math.floor(leftPx) !== Math.floor(prevLeftPx) ||
          rightPx - leftPx > 1
        ) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }
        hasClipping = hasClipping || score < niceMin || score > niceMax
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, effectiveC)
        lastCol = c
      }
      lastMix = undefined
      lastCol = undefined
      start = performance.now()
      for (const feature of features.values()) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

        if (feature.get('summary')) {
          const min = feature.get('minScore')
          const c = colorCallback(feature, min)
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          const effectiveC = crossingOrigin
            ? c
            : c === lastCol
              ? lastMix
              : (lastMix = darken(colord(c), 0.4).toHex())

          fillRectCtx(leftPx, toY(min), w, getHeight(min), ctx, effectiveC)
          lastCol = c
        }
      }
    }
  } else {
    // check if we can use batched drawing (constant color, not crossing origin)
    const featuresArray = [...features.values()]
    let constantColor: string | undefined
    let canBatch = !crossingOrigin && featuresArray.length > 0

    if (canBatch) {
      const firstFeature = featuresArray[0]!
      const firstScore = firstFeature.get('score')
      constantColor = colorCallback(firstFeature, firstScore)

      for (const feature of featuresArray) {
        const score = feature.get('score')
        if (colorCallback(feature, score) !== constantColor) {
          canBatch = false
          break
        }
      }
    }

    start = performance.now()
    if (canBatch && constantColor) {
      ctx.beginPath()
      for (const feature of featuresArray) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

        if (
          Math.floor(leftPx) !== Math.floor(prevLeftPx) ||
          rightPx - leftPx > 1
        ) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }

        const score = feature.get('score')
        hasClipping = hasClipping || score < niceMin || score > niceMax
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)

        if (summaryScoreMode === 'max') {
          const s = feature.get('summary') ? feature.get('maxScore') : score
          addRectToPath(leftPx, toY(s), w, getHeight(s), ctx)
        } else if (summaryScoreMode === 'min') {
          const s = feature.get('summary') ? feature.get('minScore') : score
          addRectToPath(leftPx, toY(s), w, getHeight(s), ctx)
        } else {
          addRectToPath(leftPx, toY(score), w, getHeight(score), ctx)
        }
      }
      ctx.fillStyle = constantColor
      ctx.fill()
    } else {
      for (const feature of featuresArray) {
        if (performance.now() - start > 400) {
          checkStopToken(stopToken)
          start = performance.now()
        }
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

        if (
          Math.floor(leftPx) !== Math.floor(prevLeftPx) ||
          rightPx - leftPx > 1
        ) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }

        const score = feature.get('score')
        const c = colorCallback(feature, score)

        hasClipping = hasClipping || score < niceMin || score > niceMax
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)

        if (summaryScoreMode === 'max') {
          const s = feature.get('summary') ? feature.get('maxScore') : score
          fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
        } else if (summaryScoreMode === 'min') {
          const s = feature.get('summary') ? feature.get('minScore') : score
          fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
        } else {
          fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
        }
      }
    }
  }

  // second pass: draw clipping
  // avoid persisting the red fillstyle with save/restore
  ctx.save()
  if (hasClipping) {
    ctx.fillStyle = clipColor
    start = performance.now()
    for (const feature of features.values()) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + fudgeFactor
      const score = feature.get('score')
      if (score > niceMax) {
        fillRectCtx(leftPx, offset, w, clipHeight, ctx)
      } else if (score < niceMin && scaleOpts.scaleType !== 'log') {
        fillRectCtx(leftPx, unadjustedHeight, w, clipHeight, ctx)
      }
    }
  }
  ctx.restore()

  if (displayCrossHatches) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'
    for (const tick of ticks.values) {
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
