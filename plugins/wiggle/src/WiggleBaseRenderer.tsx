import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'

import { blobToDataURL } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { Region } from '@jbrowse/core/util/types'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import ServerSideRendererType from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { ThemeOptions } from '@material-ui/core'
import { ScaleOpts } from './util'

export interface WiggleBaseRendererProps {
  features: Map<string, Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  forceSvg: boolean
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseFeatureDataAdapter
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  displayCrossHatches: boolean
  ticks: { values: number[] }
  theme: ThemeOptions
}

export default abstract class extends ServerSideRendererType {
  async makeImageData(props: WiggleBaseRendererProps) {
    const {
      forceSvg,
      height,
      regions,
      bpPerPx,
      highResolutionScaling = 1,
    } = props
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
    let ret
    if (!forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, props)
      const imageData = await createImageBitmap(canvas)
      ret = { imageData, height, width }
    } else {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, props)
      const imageBlob = await canvas.convertToBlob({
        type: 'image/png',
      })
      const imageData = await blobToDataURL(imageBlob)
      const element = (
        <image width={width} height={height} xlinkHref={imageData} />
      )
      ret = { imageData: element, height, width }
    }
    return ret
  }

  /** draw features to context given props */
  abstract draw(
    ctx: CanvasRenderingContext2D,
    props: WiggleBaseRendererProps,
  ): void

  async render(renderProps: WiggleBaseRendererProps) {
    const { forceSvg } = renderProps
    const { height, width, imageData } = await this.makeImageData(renderProps)

    if (forceSvg) {
      return { element: imageData, width, height }
    }
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return {
      element,
      imageData,
      height,
      width,
    }
  }
}
