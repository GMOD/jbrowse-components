import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import BaseAdapter from '@gmod/jbrowse-core/BaseAdapter'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import React from 'react'
import { ScaleOpts } from './util'

interface WiggleBaseRendererProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  blockKey: string
  dataAdapter: BaseAdapter
  notReady: boolean
  originalRegion: IRegion
  scaleOpts: ScaleOpts
  sessionId: string
  signal: AbortSignal
  trackModel: unknown
}

// TODO: Change back to severside instead of box if solution is found or different path chosen
export default class extends BoxRendererType {
  async makeImageData(props: WiggleBaseRendererProps) {
    const { height, region, bpPerPx, highResolutionScaling = 1 } = props
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

  // @ts-ignore
  async render(renderProps: WiggleBaseRendererProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      // @ts-ignore
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }
}
