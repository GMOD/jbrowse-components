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
    const startPx = bpToPx(
      feature.get('start'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
    const endPx = bpToPx(
      feature.get('end'),
      region,
      bpPerPx,
      horizontallyFlipped,
    )
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
