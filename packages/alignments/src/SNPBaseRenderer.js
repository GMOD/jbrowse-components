/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'

export default class extends ServerSideRendererType {
  async makeImageData(props) {
    const {
      height,
      features,
      region,
      bpPerPx,
      highResolutionScaling = 1,
    } = props
    const width = (region.end - region.start) / bpPerPx // width here sets the canvas viewing length, but only the first 1000 are rendered
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    // const coverageBins = this.generateCoverageBins(props)
    const featureList = this.draw(ctx, props, features)

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width, featureList }
  }

  generateCoverageBins(props) {
    /* generate coverage bins*/
  }

  draw(ctx, props, coverageBins) {
    /* draw features to context given props */
  }

  async render(renderProps) {
    const { height, width, imageData, featureList } = await this.makeImageData(
      renderProps,
    )
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData, featureList },
      null,
    )
    return { element, imageData, height, width, featureList }
  }
}
