import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import React from 'react'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { ScaleOpts } from './util'

export interface WiggleBaseRendererProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: AnyConfigurationModel
  regions: IRegion[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseFeatureDataAdapter
  notReady: boolean
  originalRegions: IRegion[]
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  trackModel: unknown
}

export default class extends ServerSideRendererType {
  async makeImageData(props: WiggleBaseRendererProps) {
    const { height, regions, bpPerPx, highResolutionScaling = 1 } = props
    const [region] = regions
    const width = (region.end - region.start) / bpPerPx
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }
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

  draw(ctx: CanvasRenderingContext2D, props: WiggleBaseRendererProps) {
    /* draw features to context given props */
  }

  async render(renderProps: WiggleBaseRendererProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }
}
