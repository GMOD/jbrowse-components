/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { filter, distinct, toArray, tap } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
import BaseAdapter from '../../BaseAdapter'
import { IRegion } from '../../mst-types'
import { checkAbortSignal } from '../../util'
import { Feature } from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'

interface RenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  filters?: any
  dataAdapter: BaseAdapter
  bpPerPx: number
  regions?: any
  config: Record<string, any>
  renderProps: { trackModel: any }
  views: any[]
}

export default class ComparativeServerSideRenderer extends RendererType {
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
        ...args.renderProps,
        // @ts-ignore
        blockKey: args.blockKey,
        // @ts-ignore
        views: args.views.map(view => {
          return {
            // @ts-ignore
            ...getSnapshot(view),
            dynamicBlocks: JSON.parse(
              JSON.stringify(view.dynamicBlocks.contentBlocks),
            ),
          }
        }),
        trackModel: {},
      }
    }

    return args
  }

  // deserialize some of the results that came back from the worker
  deserializeResultsInClient(result: { features: any }, args: RenderArgs) {
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
  serializeResultsInWorker(result: Record<string, any>, args: RenderArgs) {
    // does nothing currently
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
      'comparativeRender',
      serializedArgs,
    )

    this.deserializeResultsInClient(result, args)
    return result
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

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs: RenderArgs) {
    const { dataAdapter, signal, bpPerPx } = renderArgs

    let regions = [] as IRegion[]

    // @ts-ignore this is instantiated by the getFeatures call
    regions = renderArgs.regions

    if (!regions || regions.length === 0) {
      console.warn('no regions supplied to comparative renderer')
      return []
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

    // note that getFeaturesInMultipleRegions does not do glyph expansion
    const featureObservable = dataAdapter.getFeaturesInMultipleRegions(
      requestRegions,
      {
        signal,
        bpPerPx,
      },
    )

    return featureObservable
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        distinct(feature => feature.id()),
        toArray(),
      )
      .toPromise()
  }

  // render method called on the worker
  async renderInWorker(args: RenderArgs) {
    checkAbortSignal(args.signal)
    this.deserializeArgsInWorker(args)

    await Promise.all(
      args.views.map(async view => {
        view.features = await this.getFeatures({
          ...args,
          regions: view.dynamicBlocks.filter(
            (f: { refName: string }) => !!f.refName,
          ),
        })
      }),
    )
    checkAbortSignal(args.signal)

    const results = await this.render({ ...args })
    checkAbortSignal(args.signal)
    // @ts-ignore
    results.html = renderToString(results.element)
    delete results.element

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, args)
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
