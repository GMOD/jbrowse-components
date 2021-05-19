import { filter, ignoreElements, tap } from 'rxjs/operators'
import { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '../../util/simpleFeature'
import { Region } from '../../util/types'
import ServerSideRendererType, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderResults as ServerSideRenderResults,
  ResultsDeserialized as ServerSideResultsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
} from './ServerSideRendererType'

export interface RenderArgs extends ServerSideRenderArgs {
  displayModel: { id: string; selectedFeatureId?: string }
  regions: Region[]
  blockKey: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  displayModel: { id: string; selectedFeatureId?: string }
  regions: Region[]
  blockKey: string
}

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  dataAdapter: BaseFeatureDataAdapter
  displayModel: { id: string; selectedFeatureId?: string }
  regions: Region[]
  blockKey: string
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
   * replaces the `displayModel` param (which on the client is a MST model) with
   * a stub that only contains the `selectedFeature`, since this is the only
   * part of the track model that most renderers read. also serializes the
   * config and regions to JSON from MST objects.
   *
   * @param args - the arguments passed to render
   */
  serializeArgsInClient(args: RenderArgs) {
    const { displayModel, regions } = args
    const serializedArgs = {
      ...args,
      displayModel: displayModel && {
        id: displayModel.id,
        selectedFeatureId: displayModel.selectedFeatureId,
      },
      regions: JSON.parse(JSON.stringify(regions)),
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
    const deserializedFeatures = new Map<string, SimpleFeature>()
    result.features.forEach(j => {
      const f = SimpleFeature.fromJSON(j)
      deserializedFeatures.set(String(f.id()), f)
    })
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
   * @param results - object containing the results of calling the `render`
   * method
   * @param args - deserialized render args
   */
  serializeResultsInWorker(
    result: RenderResults,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = super.serializeResultsInWorker(result, args)
    return {
      ...serialized,
      features: iterMap(result.features.values(), f => f.toJSON()),
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
    const { dataAdapter, signal, regions } = renderArgs
    const features = new Map()

    if (!regions || regions.length === 0) {
      return features
    }

    const requestRegions = regions.map((r: Region) => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.ceil(requestRegion.end)
      }
      return requestRegion
    })

    const region = requestRegions[0]

    const featureObservable =
      requestRegions.length === 1
        ? dataAdapter.getFeatures(
            this.getExpandedRegion(region, renderArgs),
            // @ts-ignore
            renderArgs,
          )
        : // @ts-ignore
          dataAdapter.getFeaturesInMultipleRegions(requestRegions, renderArgs)

    await featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        tap(feature => {
          const id = feature.id()
          if (!id) {
            throw new Error(`invalid feature id "${id}"`)
          }
          features.set(id, feature)
        }),
        ignoreElements(),
      )
      .toPromise()

    return features
  }

  /**
   * @param renderArgs -
   * @param feature -
   * @returns true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    if (!renderArgs.filters) {
      return true
    }
    return renderArgs.filters.passes(feature, renderArgs)
  }

  /**
   * gets features and renders
   *
   * @param props - render args
   */
  async render(props: RenderArgsDeserialized): Promise<RenderResults> {
    const features =
      (props.features as undefined | Map<string, Feature>) ||
      (await this.getFeatures(props))
    const result = await super.render({ ...props, features })
    return { ...result, features }
  }
}

export class NewFeatureRendererType extends ServerSideRendererType {}
