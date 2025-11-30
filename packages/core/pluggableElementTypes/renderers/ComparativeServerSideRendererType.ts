import { firstValueFrom } from 'rxjs'
import { filter, toArray } from 'rxjs/operators'

import ServerSideRenderer from './ServerSideRendererType'
import { normalizeRegion } from './util'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { dedupe, getSerializedSvg } from '../../util'

import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
} from './ServerSideRendererType'
import type { AnyConfigurationModel } from '../../configuration'
import type SerializableFilterChain from './util/serializableFilterChain'
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

export interface RenderArgsDeserialized extends ServerSideRenderArgsDeserialized {
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

function isCanvasRecordedSvgExport(
  e: ResultsSerialized,
): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

export default class ComparativeServerSideRenderer extends ServerSideRenderer {
  async renameRegionsIfNeeded(args: RenderArgs) {
    return args
  }

  serializeArgsInClient(args: RenderArgs) {
    const { displayModel, ...serializable } = args
    return super.serializeArgsInClient(serializable)
  }

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
  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    const results = (await rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    )) as ResultsSerialized

    if (isCanvasRecordedSvgExport(results)) {
      const { reactElement, ...rest } = results
      return {
        ...rest,
        html: await getSerializedSvg(results),
      }
    } else {
      return results
    }
  }

  featurePassesFilters(
    renderArgs: {
      filters?: SerializableFilterChain
    },
    feature: Feature,
  ) {
    return renderArgs.filters
      ? renderArgs.filters.passes(feature, renderArgs)
      : true
  }

  async getFeatures(renderArgs: {
    regions: Region[]
    sessionId: string
    adapterConfig: AnyConfigurationModel
    filters?: SerializableFilterChain
  }) {
    const { regions, sessionId, adapterConfig } = renderArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const res = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(
          regions.map(r => normalizeRegion(r)),
          renderArgs,
        )
        .pipe(
          filter(f => this.featurePassesFilters(renderArgs, f)),
          toArray(),
        ),
    )

    // dedupe needed xref https://github.com/GMOD/jbrowse-components/pull/3404/
    return dedupe(res, f => f.id())
  }
}

export { type RenderResults } from './ServerSideRendererType'
