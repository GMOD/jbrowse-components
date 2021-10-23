import { Feature } from '@jbrowse/core/util/simpleFeature'
import FeatureRendererType, {
  RenderArgs as FeatureRenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
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
    const { height, regions, bpPerPx } = renderProps
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx

    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      (ctx: CanvasRenderingContext2D) =>
        this.draw(ctx, {
          ...renderProps,
          features,
        }),
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      features,
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
