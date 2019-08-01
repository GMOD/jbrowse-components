import { renderToString } from 'react-dom/server'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
import { readConfObject } from '../../configuration'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'

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
  serializeArgsInClient(args) {
    const { trackModel } = args.renderProps
    if (trackModel) {
      args.renderProps = {
        ...args.renderProps,
        trackModel: {
          selectedFeatureId: trackModel.selectedFeatureId,
          // refNameMap:
          //   trackModel.refNameMap &&
          //   objectFromEntries(trackModel.refNameMap.entries()),
        },
      }
    }
    if (args.regions) {
      args.regions = [...args.regions]
    }
    if (args.region) args.region = { ...args.region }
    return args
  }

  deserializeResultsInClient(result /* , args */) {
    // deserialize some of the results that came back from the worker
    const featuresMap = new Map()
    result.features.forEach(j => {
      const f = SimpleFeature.fromJSON({ data: j })
      featuresMap.set(String(f.id()), f)
    })
    result.features = featuresMap
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args) {
    if (this.configSchema) {
      const config = this.configSchema.create(args.config || {})
      args.config = config
    }
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(result, features) {
    result.features = iterMap(features.values(), f =>
      f.toJSON ? f.toJSON() : f,
    )
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager, args) {
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

  getExpandedGlyphRegion(region, renderArgs) {
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
  async getFeatures(renderArgs) {
    const { dataAdapter, signal, bpPerPx } = renderArgs
    let { regions } = renderArgs
    const features = new Map()
    let featureObservable

    if (!regions && renderArgs.region) {
      regions = [renderArgs.region]
    }

    if (!regions || regions.length === 0) return features

    const requestRegions = regions.map(region => {
      // make sure the requested region's start and end are integers, if
      // there is a region specification.
      const requestRegion = { ...region }
      if (requestRegion.start)
        requestRegion.start = Math.floor(requestRegion.start)
      if (requestRegion.end) requestRegion.end = Math.floor(requestRegion.end)
      return requestRegion
    })

    if (requestRegions.length === 1) {
      featureObservable = dataAdapter.getFeaturesInRegion(
        this.getExpandedGlyphRegion(requestRegions[0], renderArgs),
        {
          signal,
          bpPerPx,
        },
      )
    } else {
      featureObservable = dataAdapter.getFeaturesInMultipleRegions(
        requestRegions,
        {
          signal,
          bpPerPx,
        },
      )
    }

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
  featurePassesFilters(renderArgs, feature) {
    const filterChain = new SerializableFilterChain({
      filters: renderArgs.filters,
    })
    return filterChain.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(args) {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)

    const features = await this.getFeatures(args)
    checkAbortSignal(args.signal)

    const renderProps = { ...args, features }

    const results = await this.render({ ...renderProps, signal: args.signal })
    checkAbortSignal(args.signal)
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, features, args)
    return results
  }

  freeResourcesInClient(rpcManager, args) {
    const serializedArgs = this.serializeArgsInClient(args)

    const stateGroupName = args.sessionId
    return rpcManager.call(stateGroupName, 'freeResources', serializedArgs)
  }

  freeResourcesInWorker(args) {
    /* stub method */
  }
}
