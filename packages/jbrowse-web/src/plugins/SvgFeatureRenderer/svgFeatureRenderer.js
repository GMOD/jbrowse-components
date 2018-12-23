import React from 'react'

import {
  createCanvas,
  createImageBitmap,
} from '../../util/offscreenCanvasPonyfill'

import SvgFeatureRendering from './components/SvgFeatureRendering'

import { readConfObject } from '../../configuration'
import { bpToPx } from '../../util'

import ConfigSchema from './configSchema'
import BoxRenderer from '../../renderers/boxRenderer'

class SvgFeatureRenderer extends BoxRenderer {
  // layoutFeature(
  //   feature,
  //   subLayout,
  //   config,
  //   bpPerPx,
  //   region,
  //   horizontallyFlipped = false,
  // ) {
  //   if (horizontallyFlipped)
  //     throw new Error('horizontal flipping not yet implemented')
  //   // const leftBase = region.start
  //   const startPx = bpToPx(
  //     feature.get('start'),
  //     region,
  //     bpPerPx,
  //     horizontallyFlipped,
  //   )
  //   const endPx = bpToPx(
  //     feature.get('end'),
  //     region,
  //     bpPerPx,
  //     horizontallyFlipped,
  //   )
  //   const heightPx = readConfObject(config, 'alignmentHeight', [feature])
  //   // if (Number.isNaN(startPx)) debugger
  //   // if (Number.isNaN(endPx)) debugger
  //   if (feature.get('seq_id') !== region.refName) {
  //     debugger
  //     throw new Error(
  //       `feature ${feature.id()} is not on the current region's reference sequence ${
  //         region.refName
  //       }`,
  //     )
  //   }
  //   const topPx = subLayout.addRect(
  //     feature.id(),
  //     feature.get('start'),
  //     feature.get('end'),
  //     heightPx, // height
  //     feature,
  //   )

  //   return {
  //     feature,
  //     startPx,
  //     endPx,
  //     topPx,
  //     heightPx,
  //   }
  // }

  // async makeImageData({
  //   features,
  //   layout,
  //   config,
  //   region,
  //   bpPerPx,
  //   horizontallyFlipped,
  // }) {
  //   if (!layout) throw new Error(`layout required`)
  //   if (!layout.addRect) throw new Error('invalid layout object')

  //   const layoutRecords = features.map(feature =>
  //     this.layoutFeature(
  //       feature,
  //       layout,
  //       config,
  //       bpPerPx,
  //       region,
  //       horizontallyFlipped,
  //     ),
  //   )

  //   const width = (region.end - region.start) / bpPerPx
  //   const height = layout.getTotalHeight()
  //   if (!(width > 0) || !(height > 0)) return { height: 0, width: 0 }

  //   const canvas = createCanvas(width, height)
  //   const ctx = canvas.getContext('2d')
  //   layoutRecords.forEach(({ feature, startPx, endPx, topPx, heightPx }) => {
  //     ctx.fillStyle = readConfObject(config, 'alignmentColor', [feature])
  //     ctx.fillRect(startPx, topPx, endPx - startPx, heightPx)
  //   })

  //   const imageData = await createImageBitmap(canvas)
  //   return { imageData, height, width }
  // }

  async render(renderProps) {
    const element = React.createElement(this.ReactComponent, renderProps, null)
    return { element }
  }
}

export default (/* pluginManager */) =>
  new SvgFeatureRenderer({
    name: 'SvgFeatureRenderer',
    ReactComponent: SvgFeatureRendering,
    configSchema: ConfigSchema,
  })
