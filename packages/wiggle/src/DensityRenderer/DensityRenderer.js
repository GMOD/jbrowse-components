import { readConfObject } from '@gmod/jbrowse-core/configuration'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import { bpToPx } from '@gmod/jbrowse-core/util'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { getScale } from './util'

export class WiggleBaseRenderer extends ServerSideRendererType {
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

export default class extends WiggleBaseRenderer {
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
