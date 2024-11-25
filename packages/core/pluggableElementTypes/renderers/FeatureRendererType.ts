import clone from 'clone'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

// locals
import ServerSideRendererType from './ServerSideRendererType'
import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { iterMap } from '../../util'
import SimpleFeature from '../../util/simpleFeature'
import { checkStopToken } from '../../util/stopToken'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
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

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  displayModel: { id: string; selectedFeatureId?: string }
  regions: Region[]
  blockKey: string
  adapterConfig: AnyConfigurationModel
}

export interface RenderResults extends ServerSideRenderResults {
  features: Map<string, Feature>
}

export interface ResultsSerialized extends ServerSideResultsSerialized {
  features: SimpleFeatureSerialized[]
}

export interface ResultsDeserialized extends ServerSideResultsDeserialized {
  features: Map<string, Feature>
  blockKey: string
}

export default class FeatureRendererType extends ServerSideRendererType {
  /**
   * replaces the `displayModel` param (which on the client is a MST model)
   * with a stub that only contains the `selectedFeature`, since this is the
   * only part of the track model that most renderers read. also serializes the
   * config and regions to JSON from MST objects.
   *
   * @param args - the arguments passed to render
   */
  serializeArgsInClient(args: RenderArgs) {
    const { regions } = args
    const serializedArgs = {
      ...args,
      displayModel: undefined,
      regions: clone(regions),
    }
    return super.serializeArgsInClient(serializedArgs)
  }

  /**
   * Adds feature deserialization to base server-side result deserialization
   *
   * @param results - the results of the render
   * @param args - the arguments passed to render
   */
  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const deserializedFeatures = new Map<string, SimpleFeature>(
      result.features.map(f => SimpleFeature.fromJSON(f)).map(f => [f.id(), f]),
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

  /**
   * Adds feature serialization to base server-side result serialization
   *
   * @param result - object containing the results of calling the `render`
   * method
   * @param args - deserialized render args
   */
  serializeResultsInWorker(
    result: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = super.serializeResultsInWorker(result, args)
    const { features } = result
    return {
      ...serialized,
      features: iterMap(features.values(), f => f.toJSON(), features.size),
    }
  }

  /**
   * will expand if soft clipping or feature glyphs are shown
   *
   * @param region - rendering region
   * @param _renderArgs - render args, unused, may be used in deriving classes
   */
  getExpandedRegion(region: Region, _renderArgs: RenderArgsDeserialized) {
    return region
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param renderArgs -
   * @returns Map of features as `{ id => feature, ... }`
   */
  async getFeatures(
    renderArgs: RenderArgsDeserialized,
  ): Promise<Map<string, Feature>> {
    const pm = this.pluginManager
    const { stopToken, regions, sessionId, adapterConfig } = renderArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Adapter does not support retrieving features')
    }

    // make sure the requested region's start and end are integers, if
    // there is a region specification.
    const requestRegions = regions.map(r => {
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.ceil(requestRegion.end)
      }
      return requestRegion
    })

    const region = requestRegions[0]!

    const featureObservable =
      requestRegions.length === 1
        ? dataAdapter.getFeatures(
            this.getExpandedRegion(region, renderArgs),
            renderArgs,
          )
        : dataAdapter.getFeaturesInMultipleRegions(requestRegions, renderArgs)

    const feats = await firstValueFrom(featureObservable.pipe(toArray()))
    checkStopToken(stopToken)
    return new Map<string, Feature>(
      feats
        .filter(feat => this.featurePassesFilters(renderArgs, feat))
        .map(feat => [feat.id(), feat] as const),
    )
  }

  /**
   * @param renderArgs -
   * @param feature -
   * @returns true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    return renderArgs.filters
      ? renderArgs.filters.passes(feature, renderArgs)
      : true
  }

  /**
   * gets features and renders
   *
   * @param props - render args
   */
  async render(
    props: RenderArgsDeserialized & { features?: Map<string, Feature> },
  ): Promise<RenderResults> {
    const features = props.features || (await this.getFeatures(props))
    const result = await super.render({ ...props, features })
    return { ...result, features }
  }
}
