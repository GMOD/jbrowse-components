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
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

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
    const res = await (dataAdapter as HicDataAdapter).getResolution(
      bpPerPx / resolution,
    )

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
    const features = await (dataAdapter as BaseFeatureDataAdapter)
      .getFeatures(regions[0], args)
      .pipe(toArray())
      .toPromise()
    // cast to any to avoid return-type conflict, because the
    // types of features returned by our getFeatures are quite
    // different from the base interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return features as any
  }
}

export {
  type RenderArgsSerialized,
  type RenderResults,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
