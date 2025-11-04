import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { renderAlignment } from './renderers/renderAlignment'
import { renderMismatches } from './renderers/renderMismatches'
import { renderSoftClipping } from './renderers/renderSoftClipping'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from './util'

import type { FlatbushItem, ProcessedRenderArgs } from './types'
import type { Feature } from '@jbrowse/core/util'

interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  layoutRecords: LayoutFeature[]
  renderArgs: ProcessedRenderArgs
}) {
  const {
    stopToken,
    config,
    showSoftClip,
    colorBy,
    theme: configTheme,
  } = renderArgs
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth')
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const hideSmallIndels = readConfObject(config, 'hideSmallIndels') as boolean
  const defaultColor = readConfObject(config, 'color') === '#f0f'
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  ctx.font = 'bold 10px Courier New,monospace'

  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy?.type)
  const drawIndels = shouldDrawIndels()
  const coords = [] as number[]
  const items = [] as FlatbushItem[]
  forEachWithStopTokenCheck(layoutRecords, stopToken, feat => {
    const alignmentRet = renderAlignment({
      ctx,
      feat,
      renderArgs,
      defaultColor,
      colorMap,
      colorContrastMap,
      charWidth,
      charHeight,
      canvasWidth,
    })
    for (let i = 0, l = alignmentRet.coords.length; i < l; i++) {
      coords.push(alignmentRet.coords[i]!)
    }
    for (let i = 0, l = alignmentRet.items.length; i < l; i++) {
      items.push(alignmentRet.items[i]!)
    }
    const ret = renderMismatches({
      ctx,
      feat,
      renderArgs,
      hideSmallIndels,
      mismatchAlpha,
      drawSNPsMuted,
      drawIndels,
      largeInsertionIndicatorScale,
      minSubfeatureWidth,
      charWidth,
      charHeight,
      colorMap,
      colorContrastMap,
      canvasWidth,
    })
    for (let i = 0, l = ret.coords.length; i < l; i++) {
      coords.push(ret.coords[i]!)
    }
    for (let i = 0, l = ret.items.length; i < l; i++) {
      items.push(ret.items[i]!)
    }
    if (showSoftClip) {
      renderSoftClipping({
        ctx,
        feat,
        renderArgs,
        colorMap,
        config,
        theme,
        canvasWidth,
      })
    }
  })
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()
  return {
    flatbush: flatbush.data,
    items,
  }
}
