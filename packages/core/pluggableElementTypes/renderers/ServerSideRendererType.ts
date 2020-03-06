/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import { SnapshotOrInstance } from 'mobx-state-tree'
import { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import { IRegion } from '../../mst-types'
import { readConfObject } from '../../configuration'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature, {
  Feature,
  SimpleFeatureSerialized,
} from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'
import { AnyConfigurationModel } from '../../configuration/configurationSchema'

interface BaseRenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  filters?: any
  dataAdapter: BaseFeatureDataAdapter
  bpPerPx: number
  config: SnapshotOrInstance<AnyConfigurationModel>
  renderProps: { trackModel: any; blockKey: string }
}

interface MultiRegionRenderArgs extends BaseRenderArgs {
  regions: IRegion[]
  originalRegions: IRegion[]
}

interface SingleRegionRenderArgs extends BaseRenderArgs {
  region: IRegion
  originalRegion: IRegion
}

export type RenderArgs = MultiRegionRenderArgs | SingleRegionRenderArgs

export type RenderArgsSerialized = RenderArgs
export type RenderArgsDeserialized = RenderArgs & {
  config: AnyConfigurationModel
}

export interface RenderResults {
  html: string
}
export interface ResultsSerialized extends RenderResults {
  features: SimpleFeatureSerialized[]
}

export interface ResultsDeserialized {
  html: string
  blockKey: string
  features: Map<string, Feature>
}

export function isSingleRegionRenderArgs(
  args: RenderArgs,
): args is SingleRegionRenderArgs {
  return (
    (args as SingleRegionRenderArgs).region &&
    !(args as MultiRegionRenderArgs).regions
  )
}

export function isMultiRegionRenderArgs(
  args: RenderArgs,
): args is MultiRegionRenderArgs {
  return (
    !(args as SingleRegionRenderArgs).region &&
    (args as MultiRegionRenderArgs).regions
  )
}
export default class ServerSideRenderer extends RendererType {
  /**
   * directly modifies the render arguments to prepare
   * them to be serialized and sent to the worker.
   *
   * the base class replaces the `renderProps.trackModel` param
   * (which on the client is a MST model) with a stub
   * that only contains the `selectedFeature`, since
   * this is the only part of the track model that most
   * renderers read.
   *
   * @param {object} args the arguments passed to render
   * @returns {object} the same object
   */
  serializeArgsInClient(args: RenderArgs): RenderArgsSerialized {
    const { trackModel } = args.renderProps
    if (trackModel) {
      args.renderProps = {
        blockKey: args.blockKey,
        ...args.renderProps,
        trackModel: {
          id: trackModel.id,
          selectedFeatureId: trackModel.selectedFeatureId,
        },
      }
    }
    if (isMultiRegionRenderArgs(args)) {
      return {
        ...args,
        regions: [...args.regions],
      }
    }
    if (isSingleRegionRenderArgs(args)) {
      return { ...args, region: { ...args.region } }
    }
    throw new Error('invalid renderer args')
  }

  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    // deserialize some of the results that came back from the worker
    const deserialized = ({ ...result } as unknown) as ResultsDeserialized
    const featuresMap = new Map<string, SimpleFeature>()
    result.features.forEach((j: any) => {
      const f = SimpleFeature.fromJSON(j)
      featuresMap.set(String(f.id()), f)
    })
    deserialized.features = featuresMap
    deserialized.blockKey = args.blockKey
    return deserialized
  }

  /**
   * modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args: RenderArgsSerialized): RenderArgsDeserialized {
    const deserialized = ({ ...args } as unknown) as RenderArgsDeserialized
    const config = this.configSchema.create(args.config || {})
    deserialized.config = config
    return deserialized
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(
    result: { html: string },
    features: Map<string, Feature>,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
    const serialized = ({ ...result } as unknown) as ResultsSerialized
    serialized.features = iterMap(features.values(), f => f.toJSON())
    return serialized
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: any, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    const result = await rpcManager.call(
      stateGroupName,
      'render',
      serializedArgs,
    )
    // const result = await renderRegionWithWorker(session, serializedArgs)

    this.deserializeResultsInClient(result, args)
    return result
  }

  getExpandedGlyphRegion(region: IRegion, renderArgs: RenderArgsDeserialized) {
    if (!region) return region
    const { bpPerPx, config } = renderArgs
    const maxFeatureGlyphExpansion = readConfObject(
      config,
      'maxFeatureGlyphExpansion',
    )
    if (!maxFeatureGlyphExpansion) return region
    const bpExpansion = Math.round(maxFeatureGlyphExpansion * bpPerPx)
    return {
      ...region,
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs: RenderArgsDeserialized) {
    const { dataAdapter, signal, bpPerPx } = renderArgs
    const features = new Map()

    let regions
    let originalRegions

    if (isSingleRegionRenderArgs(renderArgs)) {
      regions = [renderArgs.region]
      originalRegions = [renderArgs.originalRegion]
    } else if (isMultiRegionRenderArgs(renderArgs)) {
      regions = renderArgs.regions
      originalRegions = renderArgs.originalRegions
    } else {
      throw new Error('invalid render args type')
    }

    if (!regions || regions.length === 0) {
      return features
    }

    const requestRegions = regions.map((r: IRegion) => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...r }
      if (requestRegion.start) {
        requestRegion.start = Math.floor(requestRegion.start)
      }
      if (requestRegion.end) {
        requestRegion.end = Math.floor(requestRegion.end)
      }
      return requestRegion
    })

    const featureObservable =
      requestRegions.length === 1
        ? dataAdapter.getFeaturesInRegion(
            this.getExpandedGlyphRegion(requestRegions[0], renderArgs),
            {
              signal,
              bpPerPx,
              originalRegion: originalRegions[0],
            },
          )
        : dataAdapter.getFeaturesInMultipleRegions(requestRegions, {
            signal,
            bpPerPx,
            originalRegions,
          })

    await featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        tap(feature => {
          const id = feature.id()
          if (!id) throw new Error(`invalid feature id "${id}"`)
          features.set(id, feature)
        }),
        ignoreElements(),
      )
      .toPromise()

    return features
  }

  /**
   * @param {object} renderArgs
   * @param {FeatureI} feature
   * @returns {boolean} true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    const filterChain = new SerializableFilterChain({
      filters: renderArgs.filters,
    })
    return filterChain.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(
    args: RenderArgsDeserialized,
  ): Promise<ResultsSerialized> {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)

    const features = await this.getFeatures(args)
    checkAbortSignal(args.signal)

    const results = await this.render({ ...args, features })
    checkAbortSignal(args.signal)
    const html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    return this.serializeResultsInWorker({ ...results, html }, features, args)
  }

  freeResourcesInClient(rpcManager: any, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    return rpcManager.call(stateGroupName, 'freeResources', serializedArgs)
  }

  freeResourcesInWorker(args: Record<string, any>) {
    /* stub method */
  }
}
