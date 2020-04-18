/* eslint-disable  @typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'

interface ReducedView {
  features: Feature[]
  displayedRegions: IRegion[]
  dynamicBlocks: IRegion[]
  horizontallyFlipped: boolean
  bpPerPx: number
}

export interface DotplotRenderProps {
  config: any
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: any
  views: ReducedView[]
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

function bpToPx(self: ReducedView, refName: string, coord: number) {
  let offset = 0

  const index = self.dynamicBlocks.findIndex((r: IRegion) => {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      offset +=
        (self.horizontallyFlipped ? r.end - coord : coord - r.start) /
        self.bpPerPx
      return true
    }
    // @ts-ignore
    offset += r.widthPx
    return false
  })
  const foundRegion = self.dynamicBlocks[index]
  if (foundRegion) {
    return Math.round(offset)
  }
  return undefined
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
    views[0].features.forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      // const identity = feature.get('numMatches') / feature.get('blockLen')
      // ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      ctx.fillStyle = 'black'
      const b1 = bpToPx(views[0], refName, start)
      const b2 = bpToPx(views[0], refName, end)
      const e1 = bpToPx(views[1], mate.refName, mate.start)
      const e2 = bpToPx(views[1], mate.refName, mate.end)
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
    // views[1].features.forEach(feature => {
    //   const start = feature.get('start')
    //   const end = feature.get('end')
    //   const refName = feature.get('refName')
    //   const mate = feature.get('mate')
    //   const b1 = bpToPx(views[0], refName, start)
    //   const b2 = bpToPx(views[0], refName, end)
    //   const e1 = bpToPx(views[1], mate.refName, mate.start)
    //   const e2 = bpToPx(views[1], mate.refName, mate.end)
    //   if (b1 && b2 && e1 && e2) {
    //     if (b1 - b2 < 3 && e1 - e2 < 3) {
    //       ctx.fillRect(b1, height - e1, 3, 3)
    //     } else {
    //       ctx.beginPath()
    //       ctx.moveTo(b1, height - e1)
    //       ctx.lineTo(b2, height - e2)
    //       ctx.stroke()
    //     }
    //   }
    // })

    // ctx.fillStyle = 'red' // readConfObject(config, 'color')
    // // const drawMode = readConfObject(config, 'drawMode')
    // ctx.fillRect(0, 0, 100, 100)

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

    return {
      element,
      imageData,
      height,
      width,
    }
  }
}
