import React from 'react'
import {
  createCanvas,
  createImageBitmap,
} from '../../util/offscreenCanvasPonyfill'
import WiggleRendering from './components/WiggleRendering'

import { readConfObjects, readConfObject } from '../../configuration'
import { bpToPx } from '../../util'
import { getScale, getOrigin } from './util'
import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class WiggleRenderer extends ServerSideRenderer {
  async makeImageData({
    features,
    region,
    bpPerPx,
    minScore,
    maxScore,
    height,
    stats,
    config = {},
    highResolutionScaling = 1,
    scaleType = 'linear',
    inverted = false,
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
    const [
      pivot,
      pivotValue,
      negColor,
      posColor,
      filled,
      type,
      clipColor,
      highlightColor,
    ] = readConfObjects(config, [
      'bicolorPivot',
      'bicolorPivotValue',
      'negColor',
      'posColor',
      'filled',
      'renderType',
      'clipColor',
      'highlightColor',
    ])
    const { min, max } = stats
    console.log(scaleType, min, max)
    const scale = getScale(scaleType, [min, max], [0, height], {
      minScore,
      maxScore,
    })
    const originY = getOrigin(scaleType)
    const [niceMin, niceMax] = scale.domain()
    console.log(niceMin, niceMax)
    const toY = rawscore => height - scale(rawscore)
    if (highResolutionScaling) {
      ctx.scale(highResolutionScaling, highResolutionScaling)
    }

    if (inverted) {
      ctx.transform(1, 0, 0, -1, 0, height)
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
      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      let c = readConfObject(config, 'color', [feature])

      if (type === 'density') {
        if (c === '#f0f') {
          c = (pivot !== 'none'
            ? getScale(scaleType, [min, max], [negColor, 'white', posColor], {
                pivotValue,
              })
            : getScale(scaleType, [min, max], ['white', posColor]))(score)
        }
        ctx.fillStyle = c
        ctx.fillRect(leftPx, 0, w, height)
      } else if (type === 'xyplot') {
        if (c === '#f0f') {
          if (score < pivotValue) c = negColor
          else c = posColor
        }
        ctx.fillStyle = c
        ctx.fillRect(
          leftPx,
          toY(score),
          w,
          filled ? toY(originY) - toY(score) : 1,
        )

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
