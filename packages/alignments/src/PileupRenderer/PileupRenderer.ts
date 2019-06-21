import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpToPx, iterMap } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { Mismatch } from '../BamAdapter/BamSlightlyLazyFeature'

interface PileupRenderProps {
  features: Map<string, Feature>
  layout: any
  config: any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  imageData: ImageBitmap
  horizontallyFlipped: boolean
}

export default class extends BoxRendererType {
  layoutFeature(
    feature: Feature,
    subLayout: any,
    config: any,
    bpPerPx: number,
    region: IRegion,
    horizontallyFlipped: boolean = false,
  ): {
    feature: Feature
    startPx: number
    endPx: number
    topPx: number
    heightPx: number
  } {
    // const leftBase = region.start
    const getCoord = (coord: number): number =>
      bpToPx(coord, region, bpPerPx, horizontallyFlipped)
    const startPx = getCoord(feature.get('start'))
    const endPx = getCoord(feature.get('end'))

    const heightPx = readConfObject(config, 'alignmentHeight', [feature])
    // if (Number.isNaN(startPx)) debugger
    // if (Number.isNaN(endPx)) debugger
    if (feature.get('refName') !== region.refName) {
      throw new Error(
        `feature ${feature.id()} is not on the current region's reference sequence ${
          region.refName
        }`,
      )
    }
    const topPx = subLayout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('end'),
      heightPx, // height
      feature,
    )

    return {
      feature,
      startPx,
      endPx,
      topPx,
      heightPx,
    }
  }

  async makeImageData({
    features,
    layout,
    config,
    region,
    bpPerPx,
    horizontallyFlipped,
  }: PileupRenderProps): Promise<{
    imageData?: ImageBitmap
    height: number
    width: number
  }> {
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout object')
    const getCoord = (coord: number): number =>
      bpToPx(coord, region, bpPerPx, horizontallyFlipped)

    const layoutRecords = iterMap(
      features.values(),
      feature =>
        this.layoutFeature(
          feature,
          layout,
          config,
          bpPerPx,
          region,
          horizontallyFlipped,
        ),
      features.size,
    )

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()
    if (!(width > 0) || !(height > 0)) return { height: 0, width: 0 }

    const canvas = createCanvas(Math.ceil(width), height)
    const ctx = canvas.getContext('2d')
    layoutRecords.forEach(({ feature, startPx, endPx, topPx, heightPx }) => {
      ctx.fillStyle = readConfObject(config, 'alignmentColor', [feature])
      ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
      const mismatches: Mismatch[] = feature.get('mismatches')
      if (mismatches) {
        const map: { [key: string]: string } = {
          A: '#00bf00',
          C: '#4747ff',
          G: '#ffa500',
          T: '#f00',
        }
        for (let i = 0; i < mismatches.length; i += 1) {
          const m = mismatches[i]

          if (m.base) {
            const mstart = feature.get('start') + m.start
            const mend = feature.get('start') + m.start + m.length
            ctx.fillStyle = map[m.base.toUpperCase()] || 'black'
            ctx.fillRect(
              getCoord(mstart),
              topPx,
              getCoord(mend) - getCoord(mstart),
              heightPx,
            )
            ctx.fillStyle = 'black'
            ctx.fillText(m.base, getCoord(mstart))
          }
        }
      }
    })

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  async render(
    renderProps: PileupRenderProps,
  ): Promise<{
    element: any
    imageData?: ImageBitmap
    height: number
    width: number
  }> {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }
}
