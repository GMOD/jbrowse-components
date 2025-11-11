import { firstValueFrom } from 'rxjs'
import { filter, toArray } from 'rxjs/operators'

import ServerSideRenderer from './ServerSideRendererType'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import { dedupe } from '../../util'
import { convertSvgExportToHtml } from './util/svgExportUtils'

import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
  ResultsSerializedBase,
} from './ServerSideRendererType'
import type SerializableFilterChain from './util/serializableFilterChain'
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

export type ResultsSerialized = ResultsSerializedBase

export interface ResultsDeserialized extends ServerSideResultsDeserialized {
  blockKey: string
}

export default class ComparativeServerSideRenderer extends ServerSideRenderer {
  async renameRegionsIfNeeded(args: RenderArgs): Promise<RenderArgs> {
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

  async renderInClient(
    rpcManager: RpcManager,
    args: RenderArgs,
  ): Promise<ResultsSerialized> {
    const results = (await rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    )) as ResultsSerialized

    return convertSvgExportToHtml(results)
  }

  featurePassesFilters(
    renderArgs: { filters?: { passes: (f: Feature, args: any) => boolean } },
    feature: Feature,
  ): boolean {
    return renderArgs.filters?.passes(feature, renderArgs) ?? true
  }

  private normalizeRegionCoordinates(region: Region): Region {
    return {
      ...region,
      start: region.start ? Math.floor(region.start) : region.start,
      end: region.end ? Math.floor(region.end) : region.end,
    }
  }

  async getFeatures(renderArgs: {
    regions: Region[]
    sessionId: string
    adapterConfig: AnyConfigurationModel
    filters?: SerializableFilterChain
  }): Promise<Feature[]> {
    const { regions, sessionId, adapterConfig } = renderArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    const normalizedRegions = regions.map(r =>
      this.normalizeRegionCoordinates(r),
    )

    const features = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeaturesInMultipleRegions(normalizedRegions, renderArgs)
        .pipe(
          filter((f: Feature) => this.featurePassesFilters(renderArgs, f)),
          toArray(),
        ),
    )

    // See: https://github.com/GMOD/jbrowse-components/pull/3404/
    return dedupe(features, f => f.id())
  }
}

export { type RenderResults } from './ServerSideRendererType'
