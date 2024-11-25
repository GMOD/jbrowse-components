import { firstValueFrom } from 'rxjs'
import { filter, toArray } from 'rxjs/operators'
import ServerSideRenderer from './ServerSideRendererType'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { dedupe, getSerializedSvg } from '../../util'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
} from './ServerSideRendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter'
import type RpcManager from '../../rpc/RpcManager'
import type { Feature } from '../../util/simpleFeature'
import type { Region } from '../../util/types'

export interface RenderArgs extends ServerSideRenderArgs {
  blockKey: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  blockKey: string
}

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  blockKey: string
}

export type ResultsSerialized = ServerSideResultsSerialized

export interface ResultsDeserialized extends ServerSideResultsDeserialized {
  blockKey: string
}

export interface ResultsSerializedSvgExport extends ResultsSerialized {
  canvasRecordedData: unknown
  width: number
  height: number
  reactElement: unknown
}

function isSvgExport(e: ResultsSerialized): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

export default class ComparativeServerSideRenderer extends ServerSideRenderer {
  /**
   * directly modifies the render arguments to prepare them to be serialized
   * and sent to the worker.
   *
   * @param args - the arguments passed to render
   * @returns the same object
   */

  async renameRegionsIfNeeded(args: RenderArgs) {
    return args
  }

  serializeArgsInClient(args: RenderArgs) {
    const deserializedArgs = {
      ...args,
      displayModel: undefined,
    }

    return super.serializeArgsInClient(deserializedArgs)
  }

  // deserialize some of the results that came back from the worker
  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    const deserialized = super.deserializeResultsInClient(result, args)
    return {
      ...deserialized,
      blockKey: args.blockKey,
    }
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `render` with the RPC manager.
   */
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const results = (await rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    )) as ResultsSerialized

    if (isSvgExport(results)) {
      results.html = await getSerializedSvg(results)
      results.reactElement = undefined
    }
    return results
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

  async getFeatures(renderArgs: {
    regions: Region[]
    sessionId: string
    adapterConfig: AnyConfigurationModel
  }) {
    const pm = this.pluginManager
    const { regions, sessionId, adapterConfig } = renderArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
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
    const res = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(requestRegions, renderArgs)
        .pipe(
          // @ts-expect-error
          filter(f => this.featurePassesFilters(renderArgs, f)),
          toArray(),
        ),
    )

    // dedupe needed xref https://github.com/GMOD/jbrowse-components/pull/3404/
    return dedupe(res, f => f.id())
  }
}

export { type RenderResults } from './ServerSideRendererType'
