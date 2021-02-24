/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { filter, toArray } from 'rxjs/operators'
import { Feature } from '../../util/simpleFeature'
import { checkAbortSignal } from '../../util'
import { Region } from '../../util/types'
import RendererType from './RendererType'
import {
  RenderArgs as BaseRenderArgs,
  RenderArgsSerialized as BaseRenderArgSerialized,
  RenderArgsDeserialized as BaseRenderArgsDeserialized,
  ResultsSerialized,
} from './ServerSideRendererType'
import RpcManager from '../../rpc/RpcManager'

export interface RenderArgs extends Omit<BaseRenderArgs, 'displayModel'> {
  displayModel: {}
}

interface RenderArgsSerialized
  extends Omit<BaseRenderArgSerialized, 'displayModel'> {
  displayModel: {}
}

interface RenderArgsDeserialized
  extends Omit<BaseRenderArgsDeserialized, 'displayModel'> {
  displayModel: {}
}

export default class ComparativeServerSideRenderer extends RendererType {
  /**
   * directly modifies the render arguments to prepare
   * them to be serialized and sent to the worker.
   *
   * the base class replaces the `displayModel` param
   * (which on the client is a MST model) with a stub
   * that only contains the `selectedFeature`, since
   * this is the only part of the track model that most
   * renderers read.
   *
   * @param args - the arguments passed to render
   * @returns the same object
   */
  serializeArgsInClient(args: RenderArgs) {
    args = {
      ...args,
      displayModel: {},
    }

    return args
  }

  // deserialize some of the results that came back from the worker
  deserializeResultsInClient(result: ResultsSerialized, args: RenderArgs) {
    // @ts-ignore
    result.blockKey = args.blockKey
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param args - the converted arguments to modify
   */
  deserializeArgsInWorker(args: RenderArgsSerialized) {
    if (this.configSchema) {
      const config = this.configSchema.create(args.config || {}, {
        pluginManager: this.pluginManager,
      })
      args.config = config
    }
  }

  /**
   *
   * @param result - object containing the results of calling the `render` method
   * @param features - Map of `feature.id() -> feature`
   */
  serializeResultsInWorker(/* result: Record<string, any>, args: RenderArgs */) {
    // does nothing currently
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    const result = await rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      serializedArgs,
    )

    // @ts-ignore
    const deserialized = this.deserializeResultsInClient(result, args)
    return deserialized
  }

  /**
   * @param renderArgs -
   * @param feature -
   * @returns true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs: RenderArgsDeserialized, feature: Feature) {
    if (!renderArgs.filters) return true
    return renderArgs.filters.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(args: RenderArgsSerialized) {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)
    checkAbortSignal(args.signal)

    const results = await this.render(args)
    checkAbortSignal(args.signal)
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(/* results, args */)
    return results
  }

  async getFeatures(renderArgs: any) {
    const { dataAdapter, signal } = renderArgs

    let regions = [] as Region[]

    // @ts-ignore this is instantiated by the getFeatures call
    regions = renderArgs.regions

    if (!regions || regions.length === 0) {
      console.warn('no regions supplied to comparative renderer')
      return []
    }

    const requestRegions = regions.map(r => {
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

    // note that getFeaturesInMultipleRegions does not do glyph expansion
    const featureObservable = dataAdapter.getFeaturesInMultipleRegions(
      requestRegions,
      {
        signal,
      },
    )

    return featureObservable
      .pipe(
        // @ts-ignore
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        toArray(),
      )
      .toPromise()
  }

  freeResourcesInClient(rpcManager: RpcManager, args: RenderArgs) {
    const serializedArgs = this.serializeArgsInClient(args)

    return rpcManager.call(args.sessionId, 'freeResources', serializedArgs)
  }

  freeResourcesInWorker(/* args: RenderArgs */) {
    /* stub method */
  }
}
