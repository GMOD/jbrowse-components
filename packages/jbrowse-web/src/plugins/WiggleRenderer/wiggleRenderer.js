import React from 'react'
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
    config,
    region,
    bpPerPx,
    horizontallyFlipped,
    yScale,
  }) {
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'height')
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
    const canvas = createCanvas(Math.ceil(width), height)
    const ctx = canvas.getContext('2d')
    const scaleType = readConfObject(config, 'scaleType')
    const inverted = readConfObject(config, 'inverted')
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const filled = readConfObject(config, 'filled')
    const type = readConfObject(config, 'renderType')
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'clipColor')

    const originY = getOrigin(scaleType, pivot, yScale)
    const scale = getScale(scaleType, [yScale.min, yScale.max], [0, height])

    if (inverted) {
      ctx.transform(1, 0, 0, -1, 0, canvas.height)
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
      const clipping = false
      const toY = rawscore => height - scale(rawscore)
      const w = rightPx - leftPx + 0.7 // fudge factor for subpixel rendering
      let c = readConfObject(config, 'color', [feature])
      let colorScale

      if (type === 'density') {
        if (c === '#f0f') {
          colorScale =
            pivot !== 'none'
              ? getScale(
                  scaleType,
                  [yScale.min, yScale.max],
                  [negColor, 'white', posColor],
                  { pivotValue },
                )
              : getScale(
                  scaleType,
                  [yScale.min, yScale.max],
                  ['white', posColor],
                )
          c = colorScale(score)
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

        if (clipping) {
          ctx.fillStyle = clipColor
          ctx.fillRect(leftPx, height - 2, w, height)
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
