import { renderToString } from 'react-dom/server'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
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
    if (args.renderProps.trackModel) {
      args.renderProps = {
        ...args.renderProps,
        trackModel: {
          selectedFeatureId: args.renderProps.trackModel.selectedFeatureId,
        },
      }
    }
    if (args.regions) {
      args.regions = [...getSnapshot(args.regions)]
    }
    if (args.region) args.region = { ...getSnapshot(args.region) }
    return args
  }

  deserializeResultsInClient(result /* , args */) {
    // deserialize some of the results that came back from the worker
    const featuresMap = new Map()
    result.features.forEach(j => {
      const f = SimpleFeature.fromJSON(j)
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
    // const result = await renderRegionWithWorker(rootModel, serializedArgs)

    this.deserializeResultsInClient(result, args)
    return result
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
      featureObservable = dataAdapter.getFeaturesInRegion(requestRegions[0], {
        signal,
        bpPerPx,
      })
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
    this.deserializeArgsInWorker(args)

    checkAbortSignal(args.signal)

    const features = await this.getFeatures(args)
    const renderProps = { ...args, features }

    checkAbortSignal(args.signal)

    const results = await this.render({ ...renderProps, signal: args.signal })
    results.html = renderToString(results.element)
    delete results.element

    checkAbortSignal(args.signal)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, features, args)
    return results
  }
}
