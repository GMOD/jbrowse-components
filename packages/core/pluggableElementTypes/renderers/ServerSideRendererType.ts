/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import BaseAdapter from '../../BaseAdapter'
import { IRegion } from '../../mst-types'
import { readConfObject } from '../../configuration'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature, { Feature } from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'

interface BaseRenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  filters?: any
  dataAdapter: BaseAdapter
  bpPerPx: number
  config: Record<string, any>
  renderProps: { trackModel: any }
}

interface MultiRegionRenderArgs extends BaseRenderArgs {
  regions: IRegion[]
  originalRegions: IRegion[]
}

interface SingleRegionRenderArgs extends BaseRenderArgs {
  region: IRegion
  originalRegion: IRegion
}

type RenderArgs = MultiRegionRenderArgs | SingleRegionRenderArgs

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
  serializeArgsInClient(args: RenderArgs) {
    const { trackModel } = args.renderProps
    if (trackModel) {
      args.renderProps = {
        // @ts-ignore
        blockKey: args.blockKey,
        ...args.renderProps,
        trackModel: {
          id: trackModel.id,
          selectedFeatureId: trackModel.selectedFeatureId,
        },
      }
    }
    if ('regions' in args) {
      const r = args as MultiRegionRenderArgs
      return { ...args, regions: [...r.regions] }
    }

    const r = args as SingleRegionRenderArgs
    return { ...args, region: { ...args.region } }
  }

  deserializeResultsInClient(result: { features: any }, args: RenderArgs) {
    // deserialize some of the results that came back from the worker
    const featuresMap = new Map<string, Feature>()
    result.features.forEach((j: any) => {
      const f = SimpleFeature.fromJSON({ data: j })
      featuresMap.set(String(f.id()), f)
    })
    result.features = featuresMap
    // @ts-ignore
    result.blockKey = args.blockKey
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args: Record<string, any>) {
    // @ts-ignore
    if (this.configSchema) {
      // @ts-ignore
      const config = this.configSchema.create(args.config || {})
      args.config = config
    }
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(
    result: Record<string, any>,
    features: Map<string, Feature>,
    args: RenderArgs,
  ) {
    result.features = iterMap(features.values(), f =>
      f.toJSON ? f.toJSON() : f,
    )
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

  getExpandedGlyphRegion(region: IRegion, renderArgs: RenderArgs) {
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
  async getFeatures(renderArgs: RenderArgs) {
    const { dataAdapter, signal, bpPerPx } = renderArgs
    const features = new Map()

    let regions
    let originalRegions

    if ((renderArgs as SingleRegionRenderArgs).region) {
      const r = renderArgs as SingleRegionRenderArgs
      regions = [r.region]
      originalRegions = [r.originalRegion]
    } else {
      const r = renderArgs as MultiRegionRenderArgs
      regions = r.regions
      originalRegions = r.originalRegions
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
  featurePassesFilters(renderArgs: RenderArgs, feature: Feature) {
    const filterChain = new SerializableFilterChain({
      filters: renderArgs.filters,
    })
    return filterChain.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(args: RenderArgs) {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)

    const features = await this.getFeatures(args)
    checkAbortSignal(args.signal)

    const results = await this.render({ ...args, features })
    checkAbortSignal(args.signal)
    // @ts-ignore
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, features, args)
    return results
  }

  freeResourcesInClient(rpcManager: any, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    return rpcManager.call(stateGroupName, 'freeResources', serializedArgs)
  }

  freeResourcesInWorker(args: RenderArgs) {
    /* stub method */
  }
}
