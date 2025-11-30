import { firstValueFrom } from 'rxjs'
import { filter, toArray } from 'rxjs/operators'

import ServerSideRenderer from './ServerSideRendererType'
import { normalizeRegion } from './util'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { dedupe } from '../../util'

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
    return {
      ...super.deserializeResultsInClient(result, args),
      blockKey: args.blockKey,
    }
  }

  async renderInClient(rpcManager: RpcManager, args: RenderArgs) {
    return rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    ) as Promise<ResultsSerialized>
  }

  async getFeatures(renderArgs: {
    regions: Region[]
    sessionId: string
    adapterConfig: AnyConfigurationModel
    filters?: SerializableFilterChain
  }) {
    const { regions, sessionId, adapterConfig, filters } = renderArgs
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
          filter(f => (filters ? filters.passes(f, renderArgs) : true)),
          toArray(),
        ),
    )

    // dedupe needed xref https://github.com/GMOD/jbrowse-components/pull/3404/
    return dedupe(res, f => f.id())
  }
}

export { type RenderResults } from './ServerSideRendererType'
