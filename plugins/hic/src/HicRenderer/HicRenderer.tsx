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
import { blobToDataURL } from '@jbrowse/core/util'
import {
  createCanvas,
  createImageBitmap,
  PonyfillOffscreenCanvas,
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
  forceSvg?: boolean
  fullSvg?: boolean
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
  async makeImageData(ctx: CanvasRenderingContext2D, props: PileupRenderProps) {
    const { features, config, bpPerPx, dataAdapter } = props
    const res = await dataAdapter.getResolution(bpPerPx)
    const w = res / (bpPerPx * Math.sqrt(2))
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
  }

  async render(renderProps: PileupRenderProps) {
    const {
      forceSvg,
      fullSvg,
      regions,
      bpPerPx,
      highResolutionScaling,
      config,
    } = renderProps
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'maxHeight')

    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0, maxHeightReached: false }
    }

    if (fullSvg) {
      const fakeCanvas = new PonyfillOffscreenCanvas(width, height)
      const fakeCtx = fakeCanvas.getContext('2d')
      await this.makeImageData(fakeCtx, renderProps)
      const imageData = fakeCanvas.getSerializedSvg()
      return { element: imageData, height, width }
    }
    if (forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )

      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      await this.makeImageData(ctx, renderProps)
      let imageData
      if (canvas.convertToBlob) {
        const imageBlob = await canvas.convertToBlob({
          type: 'image/png',
        })
        imageData = await blobToDataURL(imageBlob)
      } else {
        imageData = canvas.toDataURL()
      }
      const element = (
        <image width={width} height={height} href={imageData as string} />
      )
      return { element, height, width }
    }
    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )

    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    await this.makeImageData(ctx, renderProps)
    const imageData = await createImageBitmap(canvas)
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
    // cast to any to avoid return-type conflict, because the types of features
    // returned by our getFeatures are quite different from the base interface

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
