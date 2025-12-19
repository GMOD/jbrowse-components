import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import FeatureRendererType, {
  type RenderArgs,
  type ResultsDeserialized,
  type ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import { updateStatus } from '@jbrowse/core/util'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

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
    const {
      sessionId,
      adapterConfig,
      regions,
      statusCallback = () => {},
    } = renderProps
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const region = regions[0]!

    // Use array-based rendering when the adapter supports getFeaturesAsArrays
    const featureArrays = await (dataAdapter as any).getFeaturesAsArrays(
      region,
      renderProps,
    )
    const { renderSNPCoverageArrays } = await import('./makeImageArrays')
    return updateStatus('Rendering coverage', statusCallback, () =>
      renderSNPCoverageArrays({ ...renderProps, featureArrays }),
    )
  }
}
