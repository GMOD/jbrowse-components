/* eslint-disable  no-continue,@typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
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
  views: { features: Feature[]; displayedRegions: IRegion[] }[]
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

function bpToPx(self: any, pxPerBp: number, refName: string, coord: number) {
  let offsetBp = 0

  const index = self.displayedRegions.findIndex((r: IRegion) => {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      offsetBp += self.horizontallyFlipped ? r.end - coord : coord - r.start
      return true
    }
    offsetBp += r.end - r.start
    return false
  })
  const foundRegion = self.displayedRegions[index]
  if (foundRegion) {
    return Math.round(offsetBp * pxPerBp)
  }
  return undefined
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
    const totalBp = views.map(view =>
      view.displayedRegions
        .map(region => region.end - region.start)
        .reduce((a, b) => a + b, 0),
    )
    const canvas = createCanvas(
      Math.ceil(totalWidth * scale),
      totalHeight * scale,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)

    // background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, totalWidth, totalHeight)
    ctx.lineWidth = 1

    // draw border
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

    const wt = width / totalBp[0]
    const ht = height / totalBp[1]
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'

    const current = 0

    // clip method avoids drawing outside box
    ctx.rect(p, p, width, height)
    ctx.stroke()
    ctx.clip()

    ctx.lineWidth = 3
    ctx.fillStyle = readConfObject(config, 'color')
    views[0].features.forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const identity = feature.get('numMatches') / feature.get('blockLen')
      ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      const b1 = bpToPx(views[0], wt, refName, start)
      const b2 = bpToPx(views[0], wt, refName, end)
      const e1 = bpToPx(views[1], ht, mate.refName, mate.start)
      const e2 = bpToPx(views[1], ht, mate.refName, mate.end)
      if (b1 && b2 && e1 && e2) {
        if (b1 - b2 < 3 && e1 - e2 < 3) {
          ctx.fillRect(b1, e1, 3, 3)
        } else {
          ctx.beginPath()
          ctx.moveTo(b1, e1)
          ctx.lineTo(b2, e2)
          ctx.stroke()
        }
      }
    })
    views[1].features.forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const b1 = bpToPx(views[0], wt, refName, start)
      const b2 = bpToPx(views[0], wt, refName, end)
      const e1 = bpToPx(views[1], ht, mate.refName, mate.start)
      const e2 = bpToPx(views[1], ht, mate.refName, mate.end)
      if (b1 && b2 && e1 && e2) {
        if (b1 - b2 < 3 && e1 - e2 < 3) {
          ctx.fillRect(b1, e1, 3, 3)
        } else {
          ctx.beginPath()
          ctx.moveTo(b1, e1)
          ctx.lineTo(b2, e2)
          ctx.stroke()
        }
      }
    })

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
