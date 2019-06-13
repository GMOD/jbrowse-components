import React from 'react'
import Color from 'color'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import {
  readConfObject,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { bpToPx } from '@gmod/jbrowse-core/util'

import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import ConfigSchema from './configSchema'
import WiggleRendering from './components/WiggleRendering'
import { getScale, getOrigin } from './util'

class WiggleBaseRenderer extends ServerSideRendererType {
  async makeImageData(props) {
    const { height, region, bpPerPx, highResolutionScaling = 1 } = props
    const width = (region.end - region.start) / bpPerPx
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    this.draw(ctx, props)

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  draw(/* ctx, props */) {
    /* draw features to context given props */
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

export class DensityRendererClass extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    let colorCallback
    let colorScale
    if (readConfObject(config, 'color') === '#f0f') {
      // default color, use posColor/negColor instead
      colorScale =
        pivot !== 'none'
          ? getScale({
              ...scaleOpts,
              pivotValue,
              range: [negColor, 'white', posColor],
            })
          : getScale({ ...scaleOpts, range: ['white', posColor] })
      colorCallback = feature => colorScale(feature.get('score'))
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }

    for (const feature of features.values()) {
      const s = feature.get('start')
      const e = feature.get('end')
      let leftPx = bpToPx(s, region, bpPerPx, horizontallyFlipped)
      let rightPx = bpToPx(e, region, bpPerPx, horizontallyFlipped)
      if (horizontallyFlipped) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      ctx.fillStyle = colorCallback(feature)
      ctx.fillRect(leftPx, 0, w, height)
    }
  }
}

export class XYPlotRendererClass extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const filled = readConfObject(config, 'filled')
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore)
    const toHeight = rawscore => toY(originY) - toY(rawscore)
    let colorCallback
    if (readConfObject(config, 'color') === '#f0f') {
      colorCallback = feature =>
        feature.get('score') < pivotValue ? negColor : posColor
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }

    for (const feature of features.values()) {
      const s = feature.get('start')
      const e = feature.get('end')
      let leftPx = bpToPx(s, region, bpPerPx, horizontallyFlipped)
      let rightPx = bpToPx(e, region, bpPerPx, horizontallyFlipped)
      if (horizontallyFlipped) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      let score = feature.get('score')
      const maxr = feature.get('maxScore')
      const minr = feature.get('minScore')

      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      const c = colorCallback(feature)
      if (summaryScoreMode === 'max') {
        score = maxr === undefined ? score : maxr
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'min') {
        score = minr === undefined ? score : minr
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
      } else if (summaryScoreMode === 'whiskers') {
        // max
        if (maxr !== undefined) {
          ctx.fillStyle = Color(c)
            .lighten(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(maxr), w, filled ? toHeight(maxr) : 1)
        }

        // normal
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
        // min
        if (minr !== undefined) {
          ctx.fillStyle = Color(c)
            .darken(0.6)
            .toString()
          ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(minr) : 1)
        }
      } else {
        ctx.fillStyle = c
        ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
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
}

export function DensityRenderer() {
  return new DensityRendererClass({
    name: 'DensityRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigurationSchema(
      'DensityRenderer',
      {},
      { baseConfiguration: ConfigSchema, explicitlyTyped: true },
    ),
  })
}

export function XYPlotRenderer() {
  return new XYPlotRendererClass({
    name: 'XYPlotRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigurationSchema(
      'XYPlotRenderer',
      {},
      { baseConfiguration: ConfigSchema, explicitlyTyped: true },
    ),
  })
}
