import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import ServerSideRenderer from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import {
  dedupe,
  getSerializedSvg,
  renameRegionsIfNeeded,
  renderToAbstractCanvas,
} from '@jbrowse/core/util'
import { collectTransferables } from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { firstValueFrom } from 'rxjs'
import { filter, toArray } from 'rxjs/operators'
import { rpcResult } from 'librpc-web-mod'

import { Dotplot1DView } from '../DotplotView/model'

import type { Dotplot1DViewModel } from '../DotplotView/model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Region } from '@jbrowse/core/util'

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

export interface DotplotRenderArgsDeserialized extends RenderArgsDeserialized {
  adapterConfig: AnyConfigurationModel
  height: number
  width: number
  highResolutionScaling: number
  view: {
    hview: Dotplot1DViewModel
    vview: Dotplot1DViewModel
  }
}

export interface DotplotRenderArgs extends RenderArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  view: {
    hview: { displayedRegions: Region[] }
    vview: { displayedRegions: Region[] }
  }
}

interface ResultsSerializedSvgExport extends ResultsSerialized {
  canvasRecordedData: unknown
  width: number
  height: number
}

function isCanvasRecordedSvgExport(
  e: ResultsSerialized,
): e is ResultsSerializedSvgExport {
  return 'canvasRecordedData' in e
}

function normalizeRegion(r: Region) {
  return {
    ...r,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }
}

export default class DotplotRenderer extends ServerSideRenderer {
  supportsSVG = true

  async renameRegionsIfNeeded(args: DotplotRenderArgs) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager

    const { view, sessionId, adapterConfig } = args

    async function process(regions?: Region[]) {
      if (!assemblyManager) {
        throw new Error('No assembly manager provided')
      }
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId,
        adapterConfig,
        regions,
      })
      return result.regions
    }

    view.hview.displayedRegions = await process(view.hview.displayedRegions)
    view.vview.displayedRegions = await process(view.vview.displayedRegions)

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
    const results = (await rpcManager.call(
      args.sessionId,
      'ComparativeRender',
      args,
    )) as ResultsSerialized

    if (isCanvasRecordedSvgExport(results)) {
      const { reactElement: _, ...rest } = results
      return {
        ...rest,
        html: await getSerializedSvg(results),
      }
    }
    return results
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

  async render(renderProps: DotplotRenderArgsDeserialized) {
    const {
      width,
      height,
      view: { hview, vview },
    } = renderProps
    const dimensions = [width, height]
    const views = [hview, vview].map((snap, idx) => {
      const view = Dotplot1DView.create(snap)
      view.setVolatileWidth(dimensions[idx]!)
      return view
    })
    const target = views[0]!
    const feats = await this.getFeatures({
      ...renderProps,
      regions: target.dynamicBlocks.contentBlocks,
    })
    target.setFeatures(feats)

    const { drawDotplot } = await import('./drawDotplot')
    const ret = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      drawDotplot(ctx, { ...renderProps, views }),
    )

    const serialized = {
      ...ret,
      height,
      width,
      offsetX: views[0]!.dynamicBlocks.blocks[0]?.offsetPx || 0,
      offsetY: views[1]!.dynamicBlocks.blocks[0]?.offsetPx || 0,
      bpPerPxX: views[0]!.bpPerPx,
      bpPerPxY: views[1]!.bpPerPx,
    }

    return rpcResult(serialized, collectTransferables(ret))
  }
}
