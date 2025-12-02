import FeatureRendererType, {
  type RenderArgs,
  type ResultsDeserialized,
  type ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { rpcResult } from 'librpc-web-mod'

import type { RenderArgsDeserialized } from './types'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

interface SNPCoverageResultsSerialized extends ResultsSerialized {
  skipFeatures?: SimpleFeatureSerialized[]
}

export interface SNPCoverageResultsDeserialized extends ResultsDeserialized {
  skipFeatures: Feature[]
}

export default class SNPCoverageRenderer extends FeatureRendererType {
  supportsSVG = true

  deserializeResultsInClient(
    result: SNPCoverageResultsSerialized,
    args: RenderArgs,
  ): SNPCoverageResultsDeserialized {
    const deserialized = super.deserializeResultsInClient(result, args)
    const skipFeatures = (result.skipFeatures ?? []).map(f =>
      SimpleFeature.fromJSON(f),
    )
    // Add skip features to the features map so they get stored in the block
    // and can be accessed by the display for cross-region arc rendering
    for (const skipFeature of skipFeatures) {
      deserialized.features.set(skipFeature.id(), skipFeature)
    }
    return {
      ...deserialized,
      skipFeatures,
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const { height, regions, bpPerPx, statusCallback = () => {} } = renderProps

    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx

    const { makeImage } = await import('./makeImage')
    const { reducedFeatures, skipFeatures, ...rest } = await updateStatus(
      'Rendering coverage',
      statusCallback,
      () =>
        renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImage(ctx, { ...renderProps, features }),
        ),
    )

    const serialized = {
      ...rest,
      features: reducedFeatures.map(f => f.toJSON()),
      skipFeatures: skipFeatures.map(f => f.toJSON()),
      height,
      width,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
