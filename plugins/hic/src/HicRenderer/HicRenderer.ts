import Color from 'color'
import ServerSideRendererType, {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as ServerSideRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized as ServerSideResultsSerialized,
  ResultsDeserialized as ServerSideResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { Region } from '@jbrowse/core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { abortBreakPoint } from '@jbrowse/core/util'
import { toArray } from 'rxjs/operators'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface HicFeature {
  bin1: number
  bin2: number
  counts: number
}

interface HicDataAdapter extends BaseFeatureDataAdapter {
  getResolution: (bp: number) => number
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
}

export interface RenderArgsDeserializedWithFeatures
  extends RenderArgsDeserialized {
  features: HicFeature[]
}

export type { RenderArgsSerialized, RenderResults }

export type ResultsSerialized = ServerSideResultsSerialized

export type ResultsDeserialized = ServerSideResultsDeserialized

export default class HicRenderer extends ServerSideRendererType {
  async makeImageData(props: RenderArgsDeserializedWithFeatures) {
    const {
      features,
      config,
      regions,
      bpPerPx,
      highResolutionScaling = 1,
      dataAdapter,
      signal,
    } = props

    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'maxHeight')
    const res = await dataAdapter.getResolution(bpPerPx)
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0, maxHeightReached: false }
    }

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const w = res / (bpPerPx * Math.sqrt(2))
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
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
          // eslint-disable-next-line no-await-in-loop
          await abortBreakPoint(signal)
          start = +Date.now()
        }
      }
    }

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const {
      height,
      width,
      imageData,
      maxHeightReached,
    } = await this.makeImageData({ ...renderProps, features })

    const results = await super.render({
      ...renderProps,
      features,
      region: renderProps.regions[0],
      height,
      width,
      imageData,
    })

    return {
      ...results,
      imageData,
      height,
      width,
      maxHeightReached,
    }
  }

  async getFeatures({
    dataAdapter,
    signal,
    bpPerPx,
    regions,
  }: RenderArgsDeserialized) {
    const features = await dataAdapter
      .getFeatures(regions[0], { signal, bpPerPx })
      .pipe(toArray())
      .toPromise()
    // cast to any to avoid return-type conflict, because the
    // types of features returned by our getFeatures are quite
    // different from the base interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return features as any
  }
}
