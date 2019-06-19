import { readConfObject } from '@gmod/jbrowse-core/configuration'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { bpToPx, iterMap } from '@gmod/jbrowse-core/util'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'

export default class extends BoxRendererType {
  layoutFeature(
    feature,
    subLayout,
    config,
    bpPerPx,
    region,
    horizontallyFlipped = false,
  ) {
    // const leftBase = region.start
    const getCoord = coord =>
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
  }) {
    if (!layout) throw new Error(`layout required`)
    if (!layout.addRect) throw new Error('invalid layout object')
    const getCoord = coord =>
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
      const mismatches = feature.get('mismatches')
      if (mismatches) {
        const map = { A: '#00bf00', C: '#4747ff', G: '#ffa500', T: '#f00' }
        for (let i = 0; i < mismatches.length; i += 1) {
          const m = mismatches[i]

          if (m.altbase) {
            ctx.fillStyle = map[m.altbase.toUpperCase()]
            ctx.fillRect(
              getCoord(feature.get('start') + m.start),
              topPx,
              getCoord(feature.get('start') + m.start + m.length) -
                getCoord(feature.get('start') + m.start),
              heightPx,
            )
            ctx.fillText(
              getCoord(feature.get('start') + m.start),
              topPx,
              m.altbase,
            )
          }
        }
      }
    })

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  async render(renderProps) {
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }
}
