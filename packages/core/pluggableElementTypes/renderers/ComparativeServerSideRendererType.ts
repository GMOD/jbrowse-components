/* eslint-disable @typescript-eslint/no-explicit-any */
import { filter, toArray } from 'rxjs/operators'
import { Feature } from '../../util/simpleFeature'
import { Region } from '../../util/types'
import ServerSideRenderer, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized as ServerSideResultsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
} from './ServerSideRendererType'
import RpcManager from '../../rpc/RpcManager'

export interface RenderArgs extends ServerSideRenderArgs {
  displayModel: {}
  blockKey: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  displayModel: {}
  blockKey: string
}

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  displayModel: {}
  blockKey: string
}

export type { RenderResults }

export type ResultsSerialized = ServerSideResultsSerialized

export interface ResultsDeserialized extends ServerSideResultsDeserialized {
  blockKey: string
}

export default class ComparativeServerSideRenderer extends ServerSideRenderer {
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
    const deserializedArgs = {
      ...args,
      displayModel: {},
    }

    return super.serializeArgsInClient(deserializedArgs)
  }

  // deserialize some of the results that came back from the worker
  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const deserialized = super.deserializeResultsInClient(result, args)
    return { ...deserialized, blockKey: args.blockKey }
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    return rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    ) as Promise<ResultsSerialized>
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
}
