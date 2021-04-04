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
import { blobToDataURL, abortBreakPoint } from '@jbrowse/core/util'
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
  supportsSVG = true

  async makeImageData(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { features, config, bpPerPx, signal, dataAdapter } = props
    const res = await dataAdapter.getResolution(bpPerPx)
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
          // eslint-disable-next-line no-await-in-loop
          await abortBreakPoint(signal)
          start = +Date.now()
        }
      }
    }
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)

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

    if (fullSvg) {
      const fakeCanvas = new PonyfillOffscreenCanvas(width, height)
      const fakeCtx = fakeCanvas.getContext('2d')
      await this.makeImageData(fakeCtx, { ...renderProps, features })
      const imageData = fakeCanvas.getSerializedSvg()
      return { reactElement: imageData, height, width }
    }
    if (forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )

      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      await this.makeImageData(ctx, { ...renderProps, features })

      return {
        reactElement: (
          <image
            width={width}
            height={height}
            xlinkHref={
              canvas.convertToBlob
                ? await blobToDataURL(
                    await canvas.convertToBlob({
                      type: 'image/png',
                    }),
                  )
                : canvas.toDataURL()
            }
          />
        ),
        height,
        width,
      }
    }
    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )

    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    await this.makeImageData(ctx, { ...renderProps, features })
    const imageData = await createImageBitmap(canvas)

    return {
      reactElement: (
        <this.ReactComponent
          {...renderProps}
          region={renderProps.regions[0]}
          height={height}
          width={width}
          imageData={imageData}
        />
      ),
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
    // cast to any to avoid return-type conflict, because the
    // types of features returned by our getFeatures are quite
    // different from the base interface
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return features as any
  }
}
