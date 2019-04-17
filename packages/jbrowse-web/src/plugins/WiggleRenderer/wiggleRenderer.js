import React from 'react'

import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'

import WiggleRendering from './components/WiggleRendering'

import { readConfObject } from '../../configuration'
import { bpToPx, iterMap } from '@gmod/jbrowse-core/util'

import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class WiggleRenderer extends ServerSideRenderer {
  async makeImageData({
    features,
    config,
    region,
    stats,
    bpPerPx,
    horizontallyFlipped,
  }) {
    const width = (region.end - region.start) / bpPerPx
    const height = readConfObject(config, 'height')
    if (!(width > 0) || !(height > 0)) {
      return { height: 0, width: 0 }
    }

    const canvas = createCanvas(Math.ceil(width), height)
    const ctx = canvas.getContext('2d')
    iterMap(
      features.values(),
      feature => {
        ctx.fillStyle = readConfObject(config, 'color', [feature])
        const s = feature.get('start')
        const e = feature.get('end')
        let leftPx = bpToPx(s, region, bpPerPx, horizontallyFlipped)
        let rightPx = bpToPx(e, region, bpPerPx, horizontallyFlipped)
        if (horizontallyFlipped) {
          ;[leftPx, rightPx] = [rightPx, leftPx]
        }
        const score = feature.get('score') / stats.scoreMax
        const w = rightPx - leftPx + 0.1 // fudge factor for subpixel rendering
        if (readConfObject(config, 'inverted')) {
          ctx.fillRect(leftPx, 0, w, score * height)
        } else {
          ctx.fillRect(leftPx, (1 - score) * height, w, height)
        }
      },
      features.size,
    )

    const imageData = await createImageBitmap(canvas)
    return { imageData, height, width }
  }

  async render(renderProps) {
    renderProps.stats = {}
    Object.assign(
      renderProps.stats,
      await this.getGlobalStats(renderProps.dataAdapter),
    )
    const { height, width, imageData } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      { ...renderProps, height, width, imageData },
      null,
    )
    return { element, imageData, height, width }
  }

  async getGlobalStats(dataAdapter) {
    return dataAdapter.getGlobalStats()
  }
}

export default (/* pluginManager */) =>
  new WiggleRenderer({
    name: 'WiggleRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigSchema,
  })
