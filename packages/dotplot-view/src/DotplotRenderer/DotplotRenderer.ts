/* eslint-disable  no-continue,@typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'

interface DotplotRenderProps {
  config: any
  height: number
  width: number
  middle: boolean
  horizontallyFlipped: boolean
  highResolutionScaling: number
  linkedTrack: string
  pluginManager: any
  views: { displayedRegions: IRegion[] }[]
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
      width: totalWidth,
      height: totalHeight,
      config,
      views,
    } = props

    const canvas = createCanvas(
      Math.ceil(totalWidth * scale),
      totalHeight * scale,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    // background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, totalWidth, totalHeight)

    // border
    const p = 20
    ctx.strokeStyle = 'black'
    ctx.moveTo(p, p)
    ctx.lineTo(p, totalHeight - p)
    ctx.lineTo(totalWidth - p, totalHeight - p)
    ctx.lineTo(totalWidth - p, p)
    ctx.lineTo(p, p)
    ctx.stroke()
    const width = totalWidth - 2 * p
    const height = totalHeight - 2 * p

    const totalBp = views.map(view =>
      view.displayedRegions
        .map(region => region.end - region.start)
        .reduce((a, b) => a + b, 0),
    )

    const wt = width / totalBp[0]
    const ht = height / totalBp[1]
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    let current = 0
    views[0].displayedRegions.forEach(region => {
      const len = region.end - region.start

      ctx.fillText(region.refName, (current + len / 2) * wt, height + p + 15)
      current += len
    })

    ctx.save()
    ctx.translate(0, totalHeight)
    ctx.rotate(-Math.PI / 2)
    current = 0
    views[1].displayedRegions.forEach(region => {
      const len = region.end - region.start
      ctx.fillText(region.refName, (current + len / 2) * ht, p - 10)
      current += len
    })
    ctx.restore()

    readConfObject(config, 'color')
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
