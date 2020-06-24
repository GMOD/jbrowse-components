import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import ServerSideRendererType, {
  RenderArgsDeserialized,
  RenderArgs,
  ResultsDeserialized,
  ResultsSerialized,
} from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { Region } from '@gmod/jbrowse-core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { toArray } from 'rxjs/operators'
import { readConfObject } from '@gmod/jbrowse-core/configuration'

interface HicFeature {
  bin1: number
  bin2: number
  counts: number
}
export interface PileupRenderProps {
  features: HicFeature[]
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
        ctx.fillStyle = `rgba(255,0,0,${counts / (maxScore / 20)}`
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

  serializeResultsInWorker(
    result: { html: string },
    features: Map<string, Feature>,
    args: RenderArgsDeserialized,
  ): ResultsSerialized {
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
