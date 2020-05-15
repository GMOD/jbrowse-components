/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from 'react-dom/server'
import { Feature } from '../../util/simpleFeature'
import { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import { checkAbortSignal } from '../../util'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'

interface RenderArgs {
  blockKey: string
  sessionId: string
  signal?: AbortSignal
  filters?: any
  dataAdapter: BaseFeatureDataAdapter
  bpPerPx: number
  regions?: any
  config: Record<string, any>
  renderProps: { trackModel: any }
  width: number
  height: number
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
   * @param args - the arguments passed to render
   * @returns the same object
   */
  serializeArgsInClient(args: RenderArgs) {
    args.renderProps = {
      ...args.renderProps,
      // @ts-ignore
      blockKey: args.blockKey,

      trackModel: {},
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
   * @param args - the converted arguments to modify
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
   * @param result - object containing the results of calling the `render` method
   * @param features - Map of `feature.id() -> feature`
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
   * @param renderArgs -
   * @param feature -
   * @returns true if this feature passes all configured filters
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
    checkAbortSignal(args.signal)

    const results = await this.render(args)
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
