import React from 'react'
import Color from 'color'
import {
  createCanvas,
  createImageBitmap,
} from '../../util/offscreenCanvasPonyfill'
import WiggleRendering from './components/WiggleRendering'

import { readConfObject } from '../../configuration'
import { bpToPx } from '../../util'
import { getScale, getOrigin } from './util'
import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class WiggleRenderer extends ServerSideRenderer {
  async makeImageData({
    features,
    region,
    bpPerPx,
    scaleOpts,
    height,
    config,
    highResolutionScaling = 1,
    horizontallyFlipped = false,
  }) {
    const width = (region.end - region.start) / bpPerPx
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const filled = readConfObject(config, 'filled')
    const renderType = readConfObject(config, 'renderType')
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
    const scale = getScale(scaleOpts)
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore)
    const toHeight = rawscore => toY(originY) - toY(rawscore)
    if (highResolutionScaling) {
      ctx.scale(highResolutionScaling, highResolutionScaling)
    }

    for (const feature of features.values()) {
      const s = feature.get('start')
      const e = feature.get('end')
      let leftPx = bpToPx(s, region, bpPerPx, horizontallyFlipped)
      let rightPx = bpToPx(e, region, bpPerPx, horizontallyFlipped)
      if (horizontallyFlipped) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const score = feature.get('score')
      const maxr = feature.get('maxScore')
      const minr = feature.get('minScore')

      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      let c = readConfObject(config, 'color', [feature])

      if (renderType === 'density') {
        if (c === '#f0f') {
          c = (pivot !== 'none'
            ? getScale({ ...scaleOpts, range: [negColor, 'white', posColor] })
            : getScale({ ...scaleOpts, range: ['white', posColor] }))(score)
        }
        ctx.fillStyle = c
        ctx.fillRect(leftPx, 0, w, height)
      } else if (renderType === 'xyplot') {
        if (c === '#f0f') {
          if (score < pivotValue) c = negColor
          else c = posColor
        }

        if (summaryScoreMode === 'max' || summaryScoreMode === 'whiskers') {
          ctx.fillStyle = Color(c)
            .lighten(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(maxr), w, filled ? toHeight(maxr) : 1)
        }
        if (summaryScoreMode === 'avg' || summaryScoreMode === 'whiskers') {
          ctx.fillStyle = c
          ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
        }
        if (summaryScoreMode === 'min' || summaryScoreMode === 'whiskers') {
          ctx.fillStyle = Color(c)
            .darken(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(score) : 1)
        }

        if (highClipping) {
          ctx.fillStyle = clipColor
          ctx.fillRect(leftPx, 0, w, 4)
        } else if (lowClipping) {
          ctx.fillStyle = clipColor
          ctx.fillRect(leftPx, height - 4, w, height)
        }
        if (feature.get('highlighted')) {
          ctx.fillStyle = highlightColor
          ctx.fillRect(leftPx, 0, w, height)
        }
      }
    }

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  async render(renderProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }
}

export default (/* pluginManager */) =>
  new WiggleRenderer({
    name: 'WiggleRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigSchema,
  })
