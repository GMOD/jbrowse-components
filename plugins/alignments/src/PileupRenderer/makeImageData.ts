import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderAlignment } from './renderAlignment'
import { renderMismatches } from './renderMismatches'
import { renderSoftClipping } from './renderSoftClipping'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from './util'

import type { ProcessedRenderArgs } from './types'
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
  forEachWithStopTokenCheck(layoutRecords, stopToken, feat => {
    renderAlignment({
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
    renderMismatches({
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
  return undefined
}
