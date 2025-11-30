import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'

import type { Source } from './shared/types'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

export interface RenderArgs extends RenderArgsDeserialized {
  bpPerPx: number
  height: number
  highResolutionScaling: number
  themeOptions: ThemeOptions
}

export interface RenderArgsDeserializedWithFeatures extends RenderArgs {
  features: Map<string, Feature>
}

export interface MultiRenderArgsDeserialized extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
}

export default abstract class MultiVariantBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgs) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const rest = await renderToAbstractCanvas(width, height, renderProps, ctx =>
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
      features: new Map<string, Feature>(),
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
