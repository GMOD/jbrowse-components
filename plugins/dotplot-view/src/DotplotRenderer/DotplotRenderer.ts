import React from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Instance } from 'mobx-state-tree'
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { Dotplot1DView } from '../DotplotView/model'
import MyConfig from './configSchema'

type Dim = Instance<typeof Dotplot1DView>

export interface DotplotRenderProps {
  dataAdapter: BaseFeatureDataAdapter
  signal?: AbortSignal
  config: Instance<typeof MyConfig>
  height: number
  width: number
  fontSize: number
  highResolutionScaling: number
  pluginManager: PluginManager
  view: { hview: Dim; vview: Dim }
}

export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async makeImageData(props: DotplotRenderProps & { views: Dim[] }) {
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
    ctx.lineWidth = 3
    ctx.fillStyle = readConfObject(config, 'color')
    const [hview, vview] = views
    const db1 = hview.dynamicBlocks.contentBlocks[0].offsetPx
    const db2 = vview.dynamicBlocks.contentBlocks[0].offsetPx
    ;(hview.features || []).forEach(feature => {
      const start = feature.get('start')
      const end = feature.get('end')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const mateRef = mate.refName
      // const identity = feature.get('numMatches') / feature.get('blockLen')
      // ctx.fillStyle = `hsl(${identity * 150},50%,50%)`
      ctx.fillStyle = 'black'
      const b10 = hview.bpToPx({ refName, coord: start })
      const b20 = hview.bpToPx({ refName, coord: end })
      const e10 = vview.bpToPx({ refName: mateRef, coord: mate.start })
      const e20 = vview.bpToPx({ refName: mateRef, coord: mate.end })
      if ((b10 && b20 && e10 && e20) !== undefined) {
        const b1 = b10 - db1
        const b2 = b20 - db1
        const e1 = e10 - db2
        const e2 = e20 - db2
        if (Math.abs(b1 - b2) < 3 && Math.abs(e1 - e2) < 3) {
          ctx.fillRect(b1 - 0.5, height - e1 - 0.5, 1.5, 1.5)
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
                  currX += val / hview.bpPerPx - 0.01
                  currY += val / vview.bpPerPx - 0.01
                } else if (op === 'D') {
                  currX += val / hview.bpPerPx
                } else if (op === 'I') {
                  currY += val / vview.bpPerPx
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
    const {
      width,
      height,
      view: { hview, vview },
    } = renderProps
    const dimensions = [width, height]
    const realizedViews = [hview, vview].map((snap, idx) => {
      const view = Dotplot1DView.create(snap)
      view.setVolatileWidth(dimensions[idx])
      return view
    })
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
