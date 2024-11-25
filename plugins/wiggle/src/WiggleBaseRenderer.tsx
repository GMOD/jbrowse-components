import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'
import type { ScaleOpts, Source } from './util'
import type {
  RenderArgs as FeatureRenderArgs,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

// locals

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

export default abstract class WiggleBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    // @ts-expect-error
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
      features: reducedFeatures
        ? new Map<string, Feature>(
            reducedFeatures.map((r: Feature) => [r.id(), r]),
          )
        : results.features,
      height,
      width,
      containsNoTransferables: true,
    }
  }

  /**
   * draw features to context given props, to be used by derived renderer
   * classes
   */
  abstract draw<T extends RenderArgsDeserializedWithFeatures>(
    ctx: CanvasRenderingContext2D,

    props: T,
  ): Promise<Record<string, unknown> | undefined>
}

export type {
  RenderArgsSerialized,
  RenderResults,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
