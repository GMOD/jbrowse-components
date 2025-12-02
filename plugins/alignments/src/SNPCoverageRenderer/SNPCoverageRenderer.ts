import FeatureRendererType, {
  type RenderArgs,
  type ResultsDeserialized,
  type ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { renderToAbstractCanvas, updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
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
    const { reducedFeatures, coords, items, skipFeatures, ...rest } =
      await updateStatus('Rendering coverage', statusCallback, () =>
        renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImage(ctx, { ...renderProps, features }),
        ),
      )

    const flatbush = new Flatbush(Math.max(items.length, 1))
    if (coords.length) {
      for (let i = 0; i < coords.length; i += 4) {
        flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
      }
    } else {
      flatbush.add(0, 0)
    }
    flatbush.finish()

    const serialized = {
      ...rest,
      features: reducedFeatures.map(f => f.toJSON()),
      skipFeatures: skipFeatures.map(f => f.toJSON()),
      clickMap: {
        flatbush: flatbush.data,
        items: items,
      },
      height,
      width,
    }

    return rpcResult(serialized, collectTransferables(rest))
  }
}
