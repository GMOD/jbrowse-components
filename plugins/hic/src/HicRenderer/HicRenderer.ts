import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Color from 'color'
import ServerSideRendererType, {
  RenderArgsDeserialized,
  RenderArgs,
  ResultsDeserialized,
  ResultsSerialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import React from 'react'
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

export interface PileupRenderProps {
  features: HicFeature[]
  dataAdapter: HicDataAdapter
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
  sortObject: {
    position: number
    by: string
  }
}

export default class HicRenderer extends ServerSideRendererType {
  async makeImageData(props: PileupRenderProps) {
    const {
      features,
      config,
      regions,
      bpPerPx,
      highResolutionScaling = 1,
      dataAdapter,
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
      for (let i = 0; i < features.length; i++) {
        const { bin1, bin2, counts } = features[i]
        maxScore = Math.max(counts, maxScore)
        minBin = Math.min(Math.min(bin1, bin2), minBin)
        maxBin = Math.max(Math.max(bin1, bin2), maxBin)
      }
      ctx.rotate(-Math.PI / 4)
      for (let i = 0; i < features.length; i++) {
        const { bin1, bin2, counts } = features[i]
        ctx.fillStyle = readConfObject(config, 'color', [
          counts,
          maxScore,
          baseColor,
        ])
        ctx.fillRect((bin1 - offset) * w, (bin2 - offset) * w, w, w)
      }
    }

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
    }
  }

  async render(renderProps: PileupRenderProps) {
    const {
      height,
      width,
      imageData,
      maxHeightReached,
    } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      {
        ...renderProps,
        region: renderProps.regions[0],
        height,
        width,
        imageData,
      },
      null,
    )

    return {
      element,
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

  serializeResultsInWorker(result: { html: string }): ResultsSerialized {
    const serialized = ({ ...result } as unknown) as ResultsSerialized
    return serialized
  }

  deserializeResultsInClient(
    result: ResultsSerialized,
    args: RenderArgs,
  ): ResultsDeserialized {
    // deserialize some of the results that came back from the worker
    const deserialized = ({ ...result } as unknown) as ResultsDeserialized
    const featuresMap = new Map<string, SimpleFeature>()

    deserialized.features = featuresMap
    deserialized.blockKey = args.blockKey
    return deserialized
  }
}
