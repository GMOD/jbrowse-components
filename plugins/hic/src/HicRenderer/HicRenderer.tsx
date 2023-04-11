import ServerSideRendererType, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  ResultsSerialized as ServerSideResultsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { Region } from '@jbrowse/core/util/types'
import { abortBreakPoint } from '@jbrowse/core/util'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { toArray } from 'rxjs/operators'
import {
  AnyConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import type {
  AnyDataAdapter,
  BaseFeatureDataAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type HicAdapter from '../HicAdapter/HicAdapter'
import { firstValueFrom } from 'rxjs'

interface HicFeature {
  bin1: number
  bin2: number
  counts: number
}

export interface HicDataAdapter
  extends BaseFeatureDataAdapter<AnyConfigurationSchemaType> {
  getResolution: (bp: number) => Promise<number>
}

/** type guard for HicDataAdapter interface */
export function isHicDataAdapter(
  adapter: AnyDataAdapter,
): adapter is HicDataAdapter {
  return 'getFeatures' in adapter && 'getResolution' in adapter
}

export interface RenderArgs extends ServerSideRenderArgs {
  regions: Region[]
}

export interface RenderArgsDeserialized
  extends ServerSideRenderArgsDeserialized {
  regions: Region[]
  dataAdapter: HicAdapter
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

  async makeImageData(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const {
      features,
      config,
      bpPerPx,
      signal,
      resolution,
      sessionId,
      adapterConfig,
    } = props
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isHicDataAdapter(dataAdapter)) {
      throw new Error('data adapter is not a HicDataAdapter')
    }
    const res = await dataAdapter.getResolution(bpPerPx / resolution)

    const Color = await import('color').then(f => f.default)
    const w = res / (bpPerPx * Math.sqrt(2))
    const baseColor = Color(readConfObject(config, 'baseColor'))
    if (features.length) {
      const offset = features[0].bin1
      let maxScore = 0
      let minBin = 0
      let maxBin = 0
      await abortBreakPoint(signal)
      for (let i = 0; i < features.length; i++) {
        const { bin1, bin2, counts } = features[i]
        maxScore = Math.max(counts, maxScore)
        minBin = Math.min(Math.min(bin1, bin2), minBin)
        maxBin = Math.max(Math.max(bin1, bin2), maxBin)
      }
      await abortBreakPoint(signal)
      ctx.rotate(-Math.PI / 4)
      let start = Date.now()
      for (let i = 0; i < features.length; i++) {
        const { bin1, bin2, counts } = features[i]
        ctx.fillStyle = readConfObject(config, 'color', {
          count: counts,
          maxScore,
          baseColor,
        })
        ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
        if (+Date.now() - start > 400) {
          await abortBreakPoint(signal)
          start = +Date.now()
        }
      }
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const { config, regions, bpPerPx } = renderProps
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'maxHeight')
    const features = await this.getFeatures(renderProps)

    const res = await renderToAbstractCanvas(width, height, renderProps, ctx =>
      this.makeImageData(ctx, {
        ...renderProps,
        features,
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
      (dataAdapter as HicAdapter).getFeatures(regions[0], args).pipe(toArray()),
    )

    // cast to any to avoid return-type conflict, because the
    // types of features returned by our getFeatures are quite
    // different from the base interface
    return features
  }
}

export {
  type RenderArgsSerialized,
  type RenderResults,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
