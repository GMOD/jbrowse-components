import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from 'librpc-web-mod'

import type { ScaleOpts, Source } from './util'
import type {
  RenderArgs as FeatureRenderArgs,
  RenderArgsDeserialized as FeatureRenderArgsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import type { Feature } from '@jbrowse/core/util'
import type { ThemeOptions } from '@mui/material'

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
  inverted: boolean
  themeOptions: ThemeOptions
  statusCallback?: (arg: string) => void
}

export interface RenderArgsDeserializedWithFeatures extends RenderArgsDeserialized {
  features: Map<string, Feature>
  inverted: boolean
}

export interface MultiRenderArgsDeserialized extends RenderArgsDeserializedWithFeatures {
  sources: Source[]
}

export default abstract class WiggleBaseRenderer extends FeatureRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      inverted,
      height,
      regions,
      bpPerPx,
      statusCallback = () => {},
    } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { reducedFeatures, ...rest } = await updateStatus(
      'Rendering plot',
      statusCallback,
      () =>
        renderToAbstractCanvas(
          width,
          height,
          renderProps,
          ctx =>
            this.draw(ctx, {
              ...renderProps,
              features,
              inverted,
            }) as Promise<{ reducedFeatures: Feature[] | undefined }>,
        ),
    )

    const serialized = {
      ...rest,
      features: reducedFeatures
        ? new Map<string, Feature>(reducedFeatures.map(r => [r.id(), r]))
        : new Map<string, Feature>(),
      height,
      width,
    }

    if (rest.imageData instanceof ImageBitmap) {
      return rpcResult(serialized, [rest.imageData])
    }
    return serialized
  }

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
