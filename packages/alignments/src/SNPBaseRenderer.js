import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'

export default class extends ServerSideRendererType {
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
    const coverageBins = this.generateCoverageBins(props)
    this.draw(ctx, props, coverageBins)

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  generateCoverageBins(props) {
    /* generate coverage bins*/
  }

  draw(ctx, props, coverageBins) {
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
