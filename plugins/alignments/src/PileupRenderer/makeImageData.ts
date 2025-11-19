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
  setAlignmentFont,
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
  setAlignmentFont(ctx)

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
    const aCoords = alignmentRet.coords
    const aItems = alignmentRet.items
    const aCoordsLen = aCoords.length
    const aItemsLen = aItems.length
    for (let i = 0; i < aCoordsLen; i++) {
      coords.push(aCoords[i]!)
    }
    for (let i = 0; i < aItemsLen; i++) {
      items.push(aItems[i]!)
    }

    const ret = renderMismatches({
      ctx,
      feat,
      bpPerPx: renderArgs.bpPerPx,
      regions: renderArgs.regions,
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
    const mCoords = ret.coords
    const mItems = ret.items
    const mCoordsLen = mCoords.length
    const mItemsLen = mItems.length
    for (let i = 0; i < mCoordsLen; i++) {
      coords.push(mCoords[i]!)
    }
    for (let i = 0; i < mItemsLen; i++) {
      items.push(mItems[i]!)
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
  const coordsLen = coords.length
  if (coordsLen) {
    for (let i = 0; i < coordsLen; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2]!, coords[i + 3]!)
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
