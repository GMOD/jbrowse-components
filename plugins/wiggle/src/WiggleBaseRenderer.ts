import {
  createCanvas,
  createImageBitmap,
  PonyfillOffscreenCanvas,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'

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
  notReady: boolean
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  displayModel: unknown
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
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
    if (!forceSvg) {
      const canvas = createCanvas(
        Math.ceil(width * highResolutionScaling),
        height * highResolutionScaling,
      )
      const ctx = canvas.getContext('2d')
      ctx.scale(highResolutionScaling, highResolutionScaling)
      this.draw(ctx, props)
      const imageData = await createImageBitmap(canvas)
      return { imageData, height, width }
    }

    const fakeCanvas = new PonyfillOffscreenCanvas(width, height)
    const fakeCtx = fakeCanvas.getContext('2d')
    this.draw(fakeCtx, props)
    const imageData = fakeCanvas.getSerializedSvg()
    return { imageData, height, width }
  }

  /** draw features to context given props */
  abstract draw(
    ctx: CanvasRenderingContext2D,
    props: WiggleBaseRendererProps,
  ): void

  async render(renderProps: WiggleBaseRendererProps) {
    const { forceSvg } = renderProps
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = forceSvg
      ? imageData
      : React.createElement(
          this.ReactComponent,
          { ...renderProps, height, width, imageData },
          null,
        )

    return forceSvg
      ? {
          element,
          height,
          width,
        }
      : {
          element,
          imageData,
          height,
          width,
        }
  }
}
