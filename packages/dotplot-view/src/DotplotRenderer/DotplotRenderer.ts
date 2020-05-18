/* eslint-disable  @typescript-eslint/no-explicit-any */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Region } from '@gmod/jbrowse-core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import Base1DView, {
  Base1DViewModel,
} from '@gmod/jbrowse-core/util/Base1DViewModel'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

interface Block extends Region {
  offsetPx: number
  widthPx: number
}

export interface DotplotRenderProps {
  dataAdapter: BaseFeatureDataAdapter
  signal?: AbortSignal
  config: any
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: PluginManager
  views: Base1DViewModel[]
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
    ;(views[0].features || []).forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      // const identity = feature.get('numMatches') / feature.get('blockLen')
      // ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      ctx.fillStyle = 'black'
      const b10 = views[0].bpToPx({ refName, coord: start }) || 0
      const b20 = views[0].bpToPx({ refName, coord: end }) || 0

      const { refName: mateRef } = mate
      const e10 = views[1].bpToPx({ refName: mateRef, coord: mate.start }) || 0
      const e20 = views[1].bpToPx({ refName: mateRef, coord: mate.end }) || 0

      const b1 = b10 - db1[0].offsetPx
      const b2 = b20 - db1[0].offsetPx
      const e1 = e10 - db2[0].offsetPx
      const e2 = e20 - db2[0].offsetPx
      if (
        b1 !== undefined &&
        b2 !== undefined &&
        e1 !== undefined &&
        e2 !== undefined
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
    return createImageBitmap(canvas)
  }

  async render(renderProps: DotplotRenderProps) {
    const { width, height, views } = renderProps
    const dimensions = [width, height]
    const realizedViews = views.map((view, idx) =>
      Base1DView.create({ ...view, width: dimensions[idx] }),
    )
    await Promise.all(
      realizedViews.map(async view => {
        view.setFeatures(
          await this.getFeatures({
            ...renderProps,
            regions: view.dynamicBlocks.contentBlocks,
          }),
        )
      }),
    )
    const imageData = await this.makeImageData({
      ...renderProps,
      views: realizedViews,
    })

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
      offsetX: realizedViews[0].dynamicBlocks.blocks[0].offsetPx,
      offsetY: realizedViews[1].dynamicBlocks.blocks[0].offsetPx,
    }
  }
}
