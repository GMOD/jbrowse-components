import React from 'react'

import {
  createCanvas,
  createImageBitmap,
} from '../../util/offscreenCanvasPonyfill'

import WiggleRendering from './components/WiggleRendering'

import { readConfObject } from '../../configuration'
import { bpToPx, iterMap } from '../../util'

import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class WiggleRenderer extends ServerSideRenderer {
  async makeImageData({
    features,
    config,
    region,
    bpPerPx,
    horizontallyFlipped,
  }) {
    const width = (region.end - region.start) / bpPerPx
    const height = 200
    if (!(width > 0) || !(height > 0)) return { height: 0, width: 0 }

    const canvas = createCanvas(Math.ceil(width), height)
    const ctx = canvas.getContext('2d')
    iterMap(
      features.values(),
      feature => {
        ctx.fillStyle = readConfObject(config, 'color', [feature])
        const s = bpToPx(
          feature.get('start'),
          region,
          bpPerPx,
          horizontallyFlipped,
        )
        const e = bpToPx(
          feature.get('end'),
          region,
          bpPerPx,
          horizontallyFlipped,
        )
        ctx.fillRect(s, 0, e - s, feature.get('score'))
      },
      features.size,
    )

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

export default (/* pluginManager */) =>
  new WiggleRenderer({
    name: 'WiggleRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigSchema,
  })
