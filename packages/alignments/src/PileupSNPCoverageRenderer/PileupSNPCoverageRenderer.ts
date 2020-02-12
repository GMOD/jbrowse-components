// import { readConfObject } from '@gmod/jbrowse-core/configuration'
// import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
// import { bpSpanPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
// import {
//   createCanvas,
//   createImageBitmap,
// } from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
// import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import WiggleRendering from '@gmod/jbrowse-plugin-wiggle/src/WiggleRendering'
import PileupRenderer from '../PileupRenderer/PileupRenderer'
import SNPCoverageRenderer from '../SNPCoverageRenderer/SNPCoverageRenderer'
import PileupRendering from '../PileupRenderer/components/PileupRendering'

interface RenderProps {
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
}

export default class extends SNPCoverageRenderer {
  // @ts-ignore
  async render(renderProps: RenderProps) {
    const {
      height,
      width,
      imageData,
      maxHeightReached,
    } = await PileupRenderer.makeImageData(renderProps)
    const pileupElement = React.createElement(
      // @ts-ignore
      PileupRendering,
      { ...renderProps, height, width, imageData, key: 'pileupElement' },
      null,
    )
    const {
      height: snpHeight,
      width: snpWidth,
      imageData: snpImageData,
    } = await this.makeImageData(renderProps)
    const snpElement = React.createElement(
      // @ts-ignore
      WiggleRendering,
      {
        ...renderProps,
        height: snpHeight,
        width: snpWidth,
        imageData: snpImageData,
        key: 'SNPCoverageElement',
      },
      null,
    )
    const children = []
    if (1 === 1) children.push(snpElement)
    if (2 === 2) children.push(pileupElement)
    const element = React.createElement(this.ReactComponent, null, ...children)
    return {
      element,
      imageData,
      height,
      width,
      maxHeightReached,
      layout: renderProps.layout,
    }
  }
}
