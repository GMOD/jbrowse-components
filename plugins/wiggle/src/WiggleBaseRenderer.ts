import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import FeatureRendererType, {
  RenderArgs as FeatureRenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
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
    const { height, regions, bpPerPx, highResolutionScaling = 1 } = props
    const [region] = regions
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
    return { imageData, width }
  }

  /** draw features to context given props */
  abstract draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
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
