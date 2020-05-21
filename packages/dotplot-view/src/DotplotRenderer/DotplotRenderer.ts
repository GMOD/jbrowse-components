import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Region } from '@gmod/jbrowse-core/util/types'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Instance } from 'mobx-state-tree'
import ComparativeServerSideRendererType from './ComparativeServerSideRendererType'
import MyConfig from './configSchema'

interface Block extends Region {
  offsetPx: number
  widthPx: number
}

interface ReducedView {
  features: Feature[]
  displayedRegions: Region[]
  dynamicBlocks: Block[]
  horizontallyFlipped: boolean
  bpPerPx: number
}

export interface DotplotRenderProps {
  config: Instance<typeof MyConfig>
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: PluginManager
  views: ReducedView[]
}

function bpToPx(self: ReducedView, refName: string, coord: number) {
  let offset = 0

  const index = self.dynamicBlocks.findIndex(r => {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      offset +=
        (self.horizontallyFlipped ? r.end - coord : coord - r.start) /
        self.bpPerPx
      return true
    }
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
      if (
        typeof b1 !== 'undefined' &&
        typeof b2 !== 'undefined' &&
        typeof e1 !== 'undefined' &&
        typeof e2 !== 'undefined'
      ) {
        if (Math.abs(b1 - b2) < 3 && Math.abs(e1 - e2) < 3) {
          ctx.fillRect(b1 - 1, height - e1 - 1, 3, 3)
        } else {
          let currX = b1
          let currY = e1
          let cigar = feature.get('cg')
          if (cigar) {
            cigar = (cigar.toUpperCase().match(/\d+\D/g) || [])
              .map((op: string) => {
                // @ts-ignore
                return [op.match(/\D/)[0], parseInt(op, 10)]
              })
              .forEach(([op, val]: [string, number]) => {
                const prevX = currX
                const prevY = currY

                if (op === 'M') {
                  currX += val / views[0].bpPerPx - 0.01
                  currY += val / views[1].bpPerPx - 0.01
                } else if (op === 'D') {
                  currX += val / views[0].bpPerPx
                } else if (op === 'I') {
                  currY += val / views[1].bpPerPx
                }
                ctx.beginPath()
                ctx.moveTo(prevX, height - prevY)
                ctx.lineTo(currX, height - currY)
                ctx.stroke()
              })
          } else {
            ctx.beginPath()
            ctx.moveTo(b1, height - e1)
            ctx.lineTo(b2, height - e2)
            ctx.stroke()
          }
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

    const { views } = renderProps

    return {
      element,
      imageData,
      height,
      width,
      offsetX: views[0].dynamicBlocks[0].offsetPx,
      offsetY: views[1].dynamicBlocks[0].offsetPx,
    }
  }
}
