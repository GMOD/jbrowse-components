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
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      forceSvg,
      height,
      regions,
      bpPerPx,
      fullSvg,
      highResolutionScaling = 1,
    } = renderProps
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }

    if (!forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, { ...renderProps, features })
      const imageData = await createImageBitmap(canvas)
      return {
        features,
        reactElement: (
          <this.ReactComponent
            {...renderProps}
            height={height}
            width={width}
            imageData={imageData}
            features={features}
          />
        ),
        height,
        width,
        imageData,
      }
    }

    if (fullSvg) {
      const canvas = new PonyfillOffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      this.draw(ctx, { ...renderProps, features })
      return {
        reactElement: canvas.getSerializedSvg(),
        height,
        width,
        features,
      }
    }

    const scale = 6
    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    this.draw(ctx, { ...renderProps, features })

    // webworker has no canvas.toImageData, while node has no convertToBlob
    // so two methods needed for converting canvas to PNG
    return {
      features,
      reactElement: (
        <image
          width={width}
          height={height}
          xlinkHref={
            canvas.convertToBlob
              ? await blobToDataURL(
                  await canvas.convertToBlob({
                    type: 'image/png',
                  }),
                )
              : canvas.toDataURL()
          }
        />
      ),
      height,
      width,
    }
  }

  /*
   * draw features to context given props, to be used by derived renderer
   * classes
   */
  abstract draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserialized,
  ): void
}
