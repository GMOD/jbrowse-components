import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import type { Region } from '@jbrowse/core/util/types'

interface HicFeature {
  bin1: number
  bin2: number
  counts: number
}

interface HicDataAdapter extends BaseFeatureDataAdapter {
  getResolution: (bp: number) => Promise<number>
}

export interface RenderArgs extends ServerSideRenderArgs {
  regions: Region[]
}

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  regions: Region[]
  dataAdapter: HicDataAdapter
  bpPerPx: number
  highResolutionScaling: number
  resolution: number
  adapterConfig: AnyConfigurationModel
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: HicFeature[]
}

export type ResultsSerialized = ServerSideResultsSerialized

export type ResultsDeserialized = ServerSideResultsDeserialized

export default class HicRenderer extends ServerSideRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const { config, regions, bpPerPx } = renderProps
    const region = regions[0]!
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'maxHeight')
    const features = await this.getFeatures(renderProps)

    const { makeImageData } = await import('./makeImageData')
    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      makeImageData(ctx, {
        ...renderProps,
        features,
        pluginManager: this.pluginManager,
      }),
    )
    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      region: renderProps.regions[0],
      height,
      width,
    })

    return {
      ...results,
      ...res,
      height,
      width,
    }
  }

  async getFeatures(args: RenderArgsDeserialized) {
    const { regions, sessionId, adapterConfig } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const features = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeatures(regions[0]!, args)
        .pipe(toArray()),
    )
    // cast to any to avoid return-type conflict, because the
    // types of features returned by our getFeatures are quite
    // different from the base interface

    return features as any
  }
}

export type {
  RenderArgsSerialized,
  RenderResults,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
