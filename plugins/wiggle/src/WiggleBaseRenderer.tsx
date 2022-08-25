import FeatureRendererType, {
  RenderArgs as FeatureRenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, Feature } from '@jbrowse/core/util'
import { ThemeOptions } from '@mui/material'
import { ScaleOpts, Source } from './util'

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
  themeOptions: ThemeOptions
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
}

export interface MultiRenderArgsDeserialized
  extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
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

    // @ts-ignore
    const { reducedFeatures, ...rest } = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      ctx =>
        this.draw(ctx, {
          ...renderProps,
          features,
        }),
    )

    const results = await super.render({
      ...renderProps,
      ...rest,
      features,
      height,
      width,
    })

    return {
      ...results,
      ...rest,
      features: (reducedFeatures
        ? new Map(reducedFeatures.map((r: Feature) => [r.id(), r]))
        : results.features) as Map<string, Feature>,
      height,
      width,
      containsNoTransferables: true,
    }
  }

  /*
   * draw features to context given props, to be used by derived renderer
   * classes
   */
  abstract draw<T extends RenderArgsDeserializedWithFeatures>(
    ctx: CanvasRenderingContext2D,
    props: T,
  ): Promise<Record<string, unknown> | void>
}
