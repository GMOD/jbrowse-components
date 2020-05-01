/* eslint-disable  @typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { Base1DViewModel } from '@gmod/jbrowse-core/util/Base1DViewModel'

interface Block extends IRegion {
  offsetPx: number
  widthPx: number
}

export interface DotplotRenderProps {
  config: any
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: any
  views: Base1DViewModel[]
}

interface DotplotRenderingProps extends DotplotRenderProps {
  imageData: any
}

interface DotplotImageData {
  imageData?: ImageBitmap
  height: number
  width: number
  maxHeightReached: boolean
}

export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async makeImageData(props: DotplotRenderProps) {
    const {
      highResolutionScaling: scale = 1,
      width,
      height,
      config,
      views,
    } = props

    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = 'black'

    ctx.lineWidth = 3
    ctx.fillStyle = readConfObject(config, 'color')
    const db1 = views[0].dynamicBlocks.contentBlocks
    const db2 = views[1].dynamicBlocks.contentBlocks
    // @ts-ignore
    views[0].features.forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      // const identity = feature.get('numMatches') / feature.get('blockLen')
      // ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      ctx.fillStyle = 'black'
      // @ts-ignore
      const b1 = views[0].bpToPx(refName, start) - db1[0].offsetPx
      // @ts-ignore
      const b2 = views[0].bpToPx(refName, end) - db1[0].offsetPx
      // @ts-ignore
      const e1 = views[1].bpToPx(mate.refName, mate.start) - db2[0].offsetPx
      // @ts-ignore
      const e2 = views[1].bpToPx(mate.refName, mate.end) - db2[0].offsetPx
      if (b1 && b2 && e1 && e2) {
        if (b1 - b2 < 3 && e1 - e2 < 3) {
          ctx.fillRect(b1 - 1, height - e1 - 1, 3, 3)
        } else {
          ctx.beginPath()
          ctx.moveTo(b1, height - e1)
          ctx.lineTo(b2, height - e2)
          ctx.stroke()
        }
      }
    })
    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
    }
  }

  async render(renderProps: DotplotRenderProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)

    const element = React.createElement(
      // @ts-ignore
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )

    const { views } = renderProps

    return {
      element,
      imageData,
      height,
      width,
      offsetX: views[0].dynamicBlocks.blocks[0].offsetPx,
      offsetY: views[1].dynamicBlocks.blocks[0].offsetPx,
    }
  }
}
