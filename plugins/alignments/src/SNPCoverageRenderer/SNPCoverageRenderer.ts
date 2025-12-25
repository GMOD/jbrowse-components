import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import FeatureRendererType, {
  type RenderArgs,
  type ResultsDeserialized,
  type ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { RenderArgsDeserialized } from './types'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

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
    const { sessionId, adapterConfig, regions } = renderProps
    const pm = this.pluginManager
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const region = regions[0]!

    const feats = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeatures(region, renderProps)
        .pipe(toArray()),
    )
    const features = new Map(feats.map(f => [f.id(), f] as const))

    const { renderSNPCoverageToCanvas } = await import('./makeImage')
    return renderSNPCoverageToCanvas({ ...renderProps, features })
  }
}
