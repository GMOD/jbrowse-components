import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import ServerSideRendererType from './ServerSideRendererType'
import { normalizeRegion } from './util'
import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { iterMap } from '../../util'
import SimpleFeature from '../../util/simpleFeature'

import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderResults as ServerSideRenderResults,
  ResultsDeserialized as ServerSideResultsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
} from './ServerSideRendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { Feature, SimpleFeatureSerialized } from '../../util/simpleFeature'
import type { AugmentedRegion as Region } from '../../util/types'

export interface RenderArgs extends ServerSideRenderArgs {
  displayModel?: {
    id: string
    selectedFeatureId?: string
  }
  regions: Region[]
  blockKey: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  displayModel?: {
    id: string
    selectedFeatureId?: string
  }
  regions: Region[]
  blockKey: string
}

export interface RenderArgsDeserialized extends ServerSideRenderArgsDeserialized {
  displayModel: { id: string; selectedFeatureId?: string }
  regions: Region[]
  blockKey: string
  adapterConfig: AnyConfigurationModel
}

export interface RenderResults extends ServerSideRenderResults {
  features?: Map<string, Feature>
}

export interface ResultsSerialized extends ServerSideResultsSerialized {
  features?: SimpleFeatureSerialized[]
}

export interface ResultsDeserialized extends ServerSideResultsDeserialized {
  features: Map<string, Feature>
  blockKey: string
}

/**
 * FeatureRendererType provides feature fetching and serialization for renderers
 * that need to return features to the client (e.g., SvgFeatureRenderer for click handling).
 *
 * Canvas-based renderers that return rpcResult() with ImageBitmap bypass the feature
 * serialization and can use getFeatures() directly without going through render().
 */
export default class FeatureRendererType extends ServerSideRendererType {
  serializeArgsInClient(args: RenderArgs) {
    return super.serializeArgsInClient({
      ...args,
      displayModel: undefined,
      regions: structuredClone(args.regions),
    })
  }

  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const deserializedFeatures = new Map<string, SimpleFeature>(
      result.features
        ?.map(f => SimpleFeature.fromJSON(f))
        .map(f => [f.id(), f]),
    )

    const deserialized = super.deserializeResultsInClient(
      {
        ...result,
        features: deserializedFeatures,
      } as ServerSideResultsSerialized,
      args,
    )
    return {
      ...deserialized,
      blockKey: args.blockKey,
      features: deserializedFeatures,
    }
  }

  serializeResultsInWorker(
    result: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = super.serializeResultsInWorker(result, args)
    const { features } = result

    return {
      ...serialized,
      features:
        features instanceof Map
          ? iterMap(features.values(), f => f.toJSON(), features.size)
          : undefined,
    }
  }

  getExpandedRegion(region: Region, _renderArgs: RenderArgsDeserialized) {
    return region
  }

  async getFeatures(
    renderArgs: RenderArgsDeserialized,
  ): Promise<Map<string, Feature>> {
    const pm = this.pluginManager
    const { regions, sessionId, adapterConfig } = renderArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Adapter does not support retrieving features')
    }

    const requestRegions = regions.map(r => normalizeRegion(r))
    const featureObservable =
      requestRegions.length === 1
        ? dataAdapter.getFeatures(
            this.getExpandedRegion(requestRegions[0]!, renderArgs),
            renderArgs,
          )
        : dataAdapter.getFeaturesInMultipleRegions(requestRegions, renderArgs)

    const feats = await firstValueFrom(featureObservable.pipe(toArray()))
    return new Map<string, Feature>(
      feats
        .filter(feat => this.featurePassesFilters(renderArgs, feat))
        .map(feat => [feat.id(), feat] as const),
    )
  }

  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    return renderArgs.filters
      ? renderArgs.filters.passes(feature, renderArgs)
      : true
  }
}
