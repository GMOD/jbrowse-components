import { readConfObject } from '@jbrowse/core/configuration'
import {
  clamp,
  featureSpanPx,
  forEachWithStopTokenCheck,
} from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
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
  if (color) {
    ctx.fillStyle = color
  }
  if (height < 0) {
    ctx.fillRect(x, y + height, width, -height)
  } else {
    ctx.fillRect(x, y, width, height)
  }
}

function addRectToPath(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
) {
  if (height < 0) {
    ctx.rect(x, y + height, width, -height)
  } else {
    ctx.rect(x, y, width, height)
  }
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
    // when color is static (e.g. in Multi renderers), set fillStyle once and skip callback
    staticColor?: string
    // override config filled value (for point renderers)
    filled?: boolean
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
    staticColor,
    filled: filledProp,
  } = props
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const height = unadjustedHeight - offset * 2

  // allow filled prop to override config value (for point renderers)
  const filled = filledProp ?? readConfObject(config, 'filled')
  const clipColor = readConfObject(config, 'clipColor')
  const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const minSize = readConfObject(config, 'minSize')

  // Use d3-scale only to get the "niced" domain, then use simple arithmetic
  const scale = getScale({ ...scaleOpts, range: [0, height], inverted })
  const originY = getOrigin(scaleOpts.scaleType)
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
    ? (n: number) => {
        const scaled = (Math.log(n) / log2 - logMin) * logRatio
        return (
          clamp(height - (inverted ? height - scaled : scaled), 0, height) +
          offset
        )
      }
    : (n: number) => {
        const scaled = (n - niceMin) * linearRatio
        return (
          clamp(height - (inverted ? height - scaled : scaled), 0, height) +
          offset
        )
      }
  const toOrigin = (n: number) => toY(originY) - toY(n)
  const getHeight = (n: number) => (filled ? toOrigin(n) : Math.max(minSize, 1))

  let prevLeftPx = Number.NEGATIVE_INFINITY
  const reducedFeatures = []
  const crossingOrigin = niceMin < pivotValue && niceMax > pivotValue

  // we handle whiskers separately to render max row, min row, and avg in three
  // passes. this reduces subpixel rendering issues. note: for stylistic
  // reasons, clipping indicator is only drawn for score, not min/max score
  if (summaryScoreMode === 'whiskers') {
    // use batched drawing when staticColor is set and not crossing origin
    // this avoids allocating intermediate arrays
    if (staticColor && !crossingOrigin) {
      const colordStatic = colord(staticColor)
      const staticLightened = lighten(colordStatic, 0.4).toHex()
      const staticDarkened = darken(colordStatic, 0.4).toHex()

      // pass 1: draw max scores (lightened) - batched
      ctx.beginPath()
      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        if (feature.get('summary')) {
          const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
          const maxScore = feature.get('maxScore')
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          addRectToPath(leftPx, toY(maxScore), w, getHeight(maxScore), ctx)
        }
      })
      ctx.fillStyle = staticLightened
      ctx.fill()

      // pass 2: draw average scores - batched + collect reducedFeatures + check clipping
      const clippingState = { hasClipping: false }
      ctx.beginPath()
      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const score = feature.get('score')
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }
        clippingState.hasClipping ||=
          score > niceMax || (score < niceMin && !isLog)
        addRectToPath(leftPx, toY(score), w, getHeight(score), ctx)
      })
      ctx.fillStyle = staticColor
      ctx.fill()

      // pass 3: draw min scores (darkened) - batched
      ctx.beginPath()
      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        if (feature.get('summary')) {
          const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
          const minScore = feature.get('minScore')
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          addRectToPath(leftPx, toY(minScore), w, getHeight(minScore), ctx)
        }
      })
      ctx.fillStyle = staticDarkened
      ctx.fill()

      // pass 4: draw clipping if needed - batched
      if (clippingState.hasClipping) {
        ctx.beginPath()
        for (const feature of features.values()) {
          const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
          const score = feature.get('score')
          const w = rightPx - leftPx + fudgeFactor
          if (score > niceMax) {
            ctx.rect(leftPx, offset, w, clipHeight)
          } else if (score < niceMin && !isLog) {
            ctx.rect(leftPx, unadjustedHeight - clipHeight, w, clipHeight)
          }
        }
        ctx.fillStyle = clipColor
        ctx.fill()
      }
    } else {
      // fallback: pre-compute feature data for variable colors or crossing origin
      const featureData: {
        feature: Feature
        leftPx: number
        rightPx: number
        score: number
        maxScore: number
        minScore: number
        summary: boolean
        color: string
        lightenedColor?: string
        darkenedColor?: string
        mixedColor?: string
      }[] = []
      const clippingFeatures: { leftPx: number; w: number; high: boolean }[] =
        []
      const regionStart = region.start
      const regionEnd = region.end
      const reversed = region.reversed
      const rpx = (bp: number) =>
        Math.round(
          ((reversed ? regionEnd - bp : bp - regionStart) / bpPerPx) * 10,
        ) / 10

      let staticLightened: string | undefined
      let staticDarkened: string | undefined
      let staticMixed: string | undefined
      if (staticColor) {
        const colordStatic = colord(staticColor)
        staticLightened = lighten(colordStatic, 0.4).toHex()
        staticDarkened = darken(colordStatic, 0.4).toHex()
        staticMixed = staticColor
      }

      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        const fStart = feature.get('start')
        const fEnd = feature.get('end')
        const px1 = rpx(fStart)
        const px2 = rpx(fEnd)
        const leftPx = reversed ? px2 : px1
        const rightPx = reversed ? px1 : px2
        const score = feature.get('score')
        const maxScore = feature.get('maxScore')
        const minScore = feature.get('minScore')
        const summary = feature.get('summary')
        const color = staticColor || colorCallback(feature, score)

        featureData.push({
          feature,
          leftPx,
          rightPx,
          score,
          maxScore,
          minScore,
          summary,
          color,
          lightenedColor: staticLightened,
          darkenedColor: staticDarkened,
          mixedColor: staticMixed,
        })
        if (score > niceMax) {
          clippingFeatures.push({
            leftPx,
            w: rightPx - leftPx + fudgeFactor,
            high: true,
          })
        } else if (score < niceMin && !isLog) {
          clippingFeatures.push({
            leftPx,
            w: rightPx - leftPx + fudgeFactor,
            high: false,
          })
        }
      })

      let lastCol: string | undefined
      let lastMix: string | undefined
      // pass 1: draw max scores
      for (const fd of featureData) {
        const { leftPx, rightPx, maxScore, summary, color, lightenedColor } = fd
        if (summary) {
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          const effectiveC = crossingOrigin
            ? color
            : lightenedColor ||
              (color === lastCol
                ? lastMix
                : (lastMix = lighten(colord(color), 0.4).toHex()))
          fillRectCtx(
            leftPx,
            toY(maxScore),
            w,
            getHeight(maxScore),
            ctx,
            effectiveC,
          )
          lastCol = color
        }
      }
      lastMix = undefined
      lastCol = undefined
      // pass 2: draw average scores
      for (const fd of featureData) {
        const {
          feature,
          leftPx,
          rightPx,
          score,
          maxScore,
          minScore,
          summary,
          color,
          mixedColor,
        } = fd
        const effectiveC =
          crossingOrigin && summary
            ? mixedColor ||
              (color === lastCol
                ? lastMix
                : (lastMix = colord(colorCallback(feature, maxScore))
                    .mix(colord(colorCallback(feature, minScore)))
                    .toString()))
            : color
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }
        fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, effectiveC)
        lastCol = color
      }
      lastMix = undefined
      lastCol = undefined
      // pass 3: draw min scores
      for (const fd of featureData) {
        const { leftPx, rightPx, minScore, summary, color, darkenedColor } = fd
        if (summary) {
          const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
          const effectiveC = crossingOrigin
            ? color
            : darkenedColor ||
              (color === lastCol
                ? lastMix
                : (lastMix = darken(colord(color), 0.4).toHex()))
          fillRectCtx(
            leftPx,
            toY(minScore),
            w,
            getHeight(minScore),
            ctx,
            effectiveC,
          )
          lastCol = color
        }
      }

      if (clippingFeatures.length > 0) {
        ctx.beginPath()
        for (const { leftPx, w, high } of clippingFeatures) {
          if (high) {
            ctx.rect(leftPx, offset, w, clipHeight)
          } else {
            ctx.rect(leftPx, unadjustedHeight - clipHeight, w, clipHeight)
          }
        }
        ctx.fillStyle = clipColor
        ctx.fill()
      }
    }
  } else {
    // use batched drawing when staticColor is set - avoids intermediate array allocations
    if (staticColor) {
      const clippingState = { hasClipping: false }
      ctx.beginPath()
      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }

        const score = feature.get('score')
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)
        clippingState.hasClipping ||=
          score > niceMax || (score < niceMin && !isLog)

        if (summaryScoreMode === 'max') {
          const summary = feature.get('summary')
          const s = summary ? feature.get('maxScore') : score
          addRectToPath(leftPx, toY(s), w, getHeight(s), ctx)
        } else if (summaryScoreMode === 'min') {
          const summary = feature.get('summary')
          const s = summary ? feature.get('minScore') : score
          addRectToPath(leftPx, toY(s), w, getHeight(s), ctx)
        } else {
          addRectToPath(leftPx, toY(score), w, getHeight(score), ctx)
        }
      })
      ctx.fillStyle = staticColor
      ctx.fill()

      // draw clipping if needed - batched
      if (clippingState.hasClipping) {
        ctx.beginPath()
        for (const feature of features.values()) {
          const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
          const score = feature.get('score')
          const w = rightPx - leftPx + fudgeFactor
          if (score > niceMax) {
            ctx.rect(leftPx, offset, w, clipHeight)
          } else if (score < niceMin && !isLog) {
            ctx.rect(leftPx, unadjustedHeight - clipHeight, w, clipHeight)
          }
        }
        ctx.fillStyle = clipColor
        ctx.fill()
      }
    } else {
      // fallback for variable colors - needs clippingFeatures array
      const clippingFeatures: { leftPx: number; w: number; high: boolean }[] =
        []
      forEachWithStopTokenCheck(features.values(), stopToken, feature => {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)

        if ((leftPx | 0) !== (prevLeftPx | 0) || rightPx - leftPx > 1) {
          reducedFeatures.push(feature)
          prevLeftPx = leftPx
        }

        const score = feature.get('score')
        const w = Math.max(rightPx - leftPx + fudgeFactor, minSize)

        if (score > niceMax) {
          clippingFeatures.push({
            leftPx,
            w: rightPx - leftPx + fudgeFactor,
            high: true,
          })
        } else if (score < niceMin && !isLog) {
          clippingFeatures.push({
            leftPx,
            w: rightPx - leftPx + fudgeFactor,
            high: false,
          })
        }

        const c = colorCallback(feature, score)

        if (summaryScoreMode === 'max') {
          const summary = feature.get('summary')
          const s = summary ? feature.get('maxScore') : score
          fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
        } else if (summaryScoreMode === 'min') {
          const summary = feature.get('summary')
          const s = summary ? feature.get('minScore') : score
          fillRectCtx(leftPx, toY(s), w, getHeight(s), ctx, c)
        } else {
          fillRectCtx(leftPx, toY(score), w, getHeight(score), ctx, c)
        }
      })

      if (clippingFeatures.length > 0) {
        ctx.beginPath()
        for (const { leftPx, w, high } of clippingFeatures) {
          if (high) {
            ctx.rect(leftPx, offset, w, clipHeight)
          } else {
            ctx.rect(leftPx, unadjustedHeight - clipHeight, w, clipHeight)
          }
        }
        ctx.fillStyle = clipColor
        ctx.fill()
      }
    }
  }

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
