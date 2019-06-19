import { readConfObject } from '@gmod/jbrowse-core/configuration'
import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import { bpToPx } from '@gmod/jbrowse-core/util'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import Color from 'color'
import React from 'react'
import { getOrigin, getScale } from '../util'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

export default class extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const clipColor = readConfObject(config, 'clipColor')
    const highlightColor = readConfObject(config, 'highlightColor')
    const scale = getScale({ ...scaleOpts, range: [0, height] })
    const [niceMin, niceMax] = scale.domain()
    const toY = rawscore => height - scale(rawscore)
    let colorCallback
    if (readConfObject(config, 'color') === '#f0f') {
      colorCallback = feature =>
        feature.get('score') < pivotValue ? negColor : posColor
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }
    const getCoord = coord =>
      bpToPx(coord, region, bpPerPx, horizontallyFlipped)
    let lastVal

    for (const feature of features.values()) {
      let leftPx = getCoord(feature.get('start'))
      let rightPx = getCoord(feature.get('end'))
      if (horizontallyFlipped) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const score = feature.get('score')
      const lowClipping = score < niceMin
      const highClipping = score > niceMax
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering

      const c = colorCallback(feature)

      ctx.strokeStyle = c
      ctx.beginPath()
      ctx.moveTo(leftPx, toY(typeof lastVal !== 'undefined' ? lastVal : score))
      ctx.lineTo(leftPx, toY(score))
      ctx.lineTo(rightPx, toY(score))
      ctx.stroke()
      lastVal = score

      if (highClipping) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, 0, w, 4)
      } else if (lowClipping) {
        ctx.fillStyle = clipColor
        ctx.fillRect(leftPx, height - 4, w, height)
      }
      if (feature.get('highlighted')) {
        ctx.fillStyle = highlightColor
        ctx.fillRect(leftPx, 0, w, height)
      }
    }
  }
}
