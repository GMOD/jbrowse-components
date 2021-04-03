import {
  createCanvas,
  createImageBitmap,
  PonyfillOffscreenCanvas,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'

import { blobToDataURL } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import FeatureRendererType, {
  RenderArgs as FeatureRenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'
import { ThemeOptions } from '@material-ui/core'
import { ScaleOpts } from './util'

export interface RenderArgs extends FeatureRenderArgs {
  scaleOpts: ScaleOpts
}

export interface RenderArgsDeserialized extends FeatureRenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  scaleOpts: ScaleOpts
  displayCrossHatches: boolean
  ticks: { values: number[] }
  theme: ThemeOptions
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
}

export type {
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
}

export default abstract class WiggleBaseRenderer extends FeatureRendererType {
  async makeImageData(props: RenderArgsDeserializedWithFeatures) {
    const { forceSvg, height, regions, bpPerPx, fullSvg } = props
    let highResolutionScaling = props.highResolutionScaling || 1
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
    let ret
    if (!forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, props)
      const imageData = await createImageBitmap(canvas)
      ret = { imageData, height, width }
    } else if (fullSvg) {
      const fakeCanvas = new PonyfillOffscreenCanvas(width, height)
      const fakeCtx = fakeCanvas.getContext('2d')
      this.draw(fakeCtx, props)
      const imageData = fakeCanvas.getSerializedSvg()
      ret = { imageData, height, width }
    } else {
      // for high qual exports use 4 scale factor
      highResolutionScaling = 6
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, props)
      let imageData

      // webworker has no toImageData while node has no convertToBlob
      if (canvas.convertToBlob) {
        const imageBlob = await canvas.convertToBlob({
          type: 'image/png',
        })
        imageData = await blobToDataURL(imageBlob)
      } else {
        imageData = canvas.toDataURL()
      }
      const element = (
        <image width={width} height={height} xlinkHref={imageData as string} />
      )
      ret = { imageData: element, height, width }
    }
    return ret
  }

  /** draw features to context given props */
  abstract draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserialized,
  ): void

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { width, imageData } = await this.makeImageData({
      ...renderProps,
      features,
    })
    const results = await super.render({
      ...renderProps,
      features,
      width,
      imageData,
    })
    return { ...results, imageData, width }
  }
}
